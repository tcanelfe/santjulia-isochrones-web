# =============================================================================
# export_static_pngs.R
#
# Precomputes official cartographic PNG exports for the Next.js prototype by
# reusing the v6 Shiny/R export engine. The web app then links to the generated
# files from public/exports/manifest.json; it does not run R at request time.
#
# Run from prototype root:
#   Rscript scripts/export_static_pngs.R
# =============================================================================

required <- c("sf", "dplyr", "jsonlite", "ggplot2", "patchwork", "png")
missing <- required[!vapply(required, requireNamespace, logical(1), quietly = TRUE)]
if (length(missing)) {
  stop("Missing packages: ", paste(missing, collapse = ", "),
       "\nInstall them locally before running PNG export generation.")
}

library(sf)
library(dplyr)

args <- commandArgs(trailingOnly = FALSE)
file_arg <- grep("^--file=", args, value = TRUE)
script_dir <- if (length(file_arg)) {
  dirname(normalizePath(sub("^--file=", "", file_arg[[1]])))
} else {
  normalizePath("scripts", mustWork = TRUE)
}
PROTO_DIR <- normalizePath(file.path(script_dir, ".."), mustWork = TRUE)

# The web repo may be cloned outside the Isochrones/ folder (for example ~/dev).
# Prefer an explicit environment variable, then fall back to the original sibling
# layout used during local prototype development.
V6_DIR_ENV <- Sys.getenv("SANTJULIA_V6_DIR", unset = "")
V6_CANDIDATES <- c(
  V6_DIR_ENV,
  file.path(PROTO_DIR, "..", "v6"),
  file.path(PROTO_DIR, "..", "Isochrones", "v6")
)
V6_CANDIDATES <- V6_CANDIDATES[nzchar(V6_CANDIDATES)]
V6_DIR <- NULL
for (candidate in V6_CANDIDATES) {
  candidate_norm <- normalizePath(candidate, mustWork = FALSE)
  if (file.exists(file.path(candidate_norm, "shiny_app", "export_static_map.R")) &&
      file.exists(file.path(candidate_norm, "R", "constants.R"))) {
    V6_DIR <- candidate_norm
    break
  }
}
if (is.null(V6_DIR)) {
  stop(
    "Cannot locate the Sant Julia v6 folder. Run with the real path, for example:\n",
    'SANTJULIA_V6_DIR="/path/to/Isochrones/v6" npm run export:png'
  )
}
message("Using v6 directory: ", V6_DIR)
DATA_DIR <- file.path(PROTO_DIR, "public", "data")
EXPORT_DIR <- file.path(PROTO_DIR, "public", "exports")
dir.create(EXPORT_DIR, recursive = TRUE, showWarnings = FALSE)

slug <- function(x) {
  x <- iconv(x, from = "UTF-8", to = "ASCII//TRANSLIT")
  x <- tolower(gsub("[^a-zA-Z0-9]+", "_", x))
  gsub("(^_|_$)", "", x)
}

read_json <- function(path) jsonlite::read_json(path, simplifyVector = TRUE)

scenarios <- read_json(file.path(DATA_DIR, "scenarios.json"))
destinations <- read_json(file.path(DATA_DIR, "destinations.json"))
coverage_category <- read_json(file.path(DATA_DIR, "coverage_by_category.json"))
category_keys <- sort(unique(coverage_category$key))

# Load the canonical v6 exporter as a function module.
EXPORT_FUNCTION_ONLY <- TRUE
.export_env <- new.env(parent = globalenv())
.export_env$EXPORT_FUNCTION_ONLY <- TRUE
sys.source(file.path(V6_DIR, "shiny_app", "export_static_map.R"),
           envir = .export_env, chdir = TRUE)
export_static_map <- .export_env$export_static_map

ISO_PATH <- file.path(V6_DIR, "outputs", "isochrones.gpkg")
POB_PATH <- file.path(V6_DIR, "data", "Poblacio_santju.gpkg")
ESPAI_POLY_PATH <- file.path(V6_DIR, "data", "Espais lliures.gpkg")
APARCAMENTS_PATH <- file.path(V6_DIR, "data", "Aparcaments.gpkg")
WWW_DIR <- file.path(V6_DIR, "shiny_app", "www")

message("Loading v6 data once for PNG batch...")
isochrones <- sf::st_read(ISO_PATH, layer = "isochrones", quiet = TRUE) |>
  sf::st_make_valid()
crs_analysis <- sf::st_crs(isochrones)
equip_pts <- sf::st_read(ISO_PATH, layer = "equipaments", quiet = TRUE) |>
  sf::st_transform(crs_analysis)
espai_pts <- sf::st_read(ISO_PATH, layer = "espais_entrades", quiet = TRUE) |>
  sf::st_transform(crs_analysis)
pob_raw <- sf::st_read(POB_PATH, quiet = TRUE) |>
  sf::st_transform(crs_analysis) |>
  sf::st_make_valid()
prepare_population <- get("prepare_population", envir = .export_env, inherits = TRUE)
pob_pts <- prepare_population(pob_raw)

espai_poly <- NULL
if (file.exists(ESPAI_POLY_PATH)) {
  espai_poly <- tryCatch({
    p <- sf::st_read(ESPAI_POLY_PATH, layer = "Espais lliures finals", quiet = TRUE) |>
      sf::st_transform(crs_analysis) |>
      sf::st_make_valid()
    if ("Nom" %in% names(p) && !"nom" %in% names(p)) p <- dplyr::rename(p, nom = Nom)
    if ("nom" %in% names(p)) {
      p$nom <- sub("d'Axirivall", "d'Aixirivall", p$nom, fixed = TRUE)
      p$nom <- sub("Parc infantil Camp de Perot", "Parc Infantil Camp de Perot", p$nom, fixed = TRUE)
    }
    p
  }, error = function(e) {
    warning("Could not read espais polygons: ", conditionMessage(e)); NULL
  })
}

aparcaments <- NULL
if (file.exists(APARCAMENTS_PATH)) {
  aparcaments <- tryCatch({
    lyr <- sf::st_layers(APARCAMENTS_PATH)$name[[1]]
    sf::st_read(APARCAMENTS_PATH, layer = lyr, quiet = TRUE) |>
      sf::st_transform(crs_analysis) |>
      sf::st_make_valid()
  }, error = function(e) {
    warning("Could not read aparcaments: ", conditionMessage(e)); NULL
  })
}

# Precomputed exports use the clean default map: isochrones + selected subject.
# Extra overlay layers remain available in the interactive map but are not baked
# into the official batch unless this map_state is changed deliberately.
default_map_state <- list(
  show_5 = TRUE, show_10 = TRUE, show_15 = TRUE,
  show_eq = FALSE, show_es = FALSE, show_ap = FALSE
)

manifest <- list()
idx <- 1L

# Detect a converter. We keep R producing PNG (the v6 exporter only knows PNG)
# and recompress to JPG afterwards. JPG at q=90 is ~5x smaller than 300-DPI PNG
# for these maps and visually indistinguishable. Prefer the magick R package if
# available (cross-platform); fall back to the macOS-native `sips` CLI; else
# keep PNG with a warning.
has_magick <- requireNamespace("magick", quietly = TRUE)
has_sips <- nchar(Sys.which("sips")) > 0
if (has_magick) {
  message("JPG conversion: magick R package")
} else if (has_sips) {
  message("JPG conversion: macOS sips CLI")
} else {
  warning("Neither magick R package nor sips CLI available — exports will stay as PNG.")
}

png_to_jpg <- function(png_path, jpg_path, quality = 90L) {
  if (has_magick) {
    img <- magick::image_read(png_path)
    magick::image_write(img, path = jpg_path, format = "jpg", quality = quality)
    return(TRUE)
  }
  if (has_sips) {
    res <- suppressWarnings(system2(
      "sips",
      args = c("-s", "format", "jpeg", "-s", "formatOptions", as.character(quality),
               shQuote(png_path), "--out", shQuote(jpg_path)),
      stdout = FALSE, stderr = FALSE
    ))
    return(res == 0L)
  }
  FALSE
}

write_one <- function(scope, key, scenario_id, category_mode = FALSE) {
  base <- paste0(slug(key), "_", scenario_id, "_mapa")
  if (scope == "category") base <- paste0("categoria_", base)
  png_name <- paste0(base, ".png")
  jpg_name <- paste0(base, ".jpg")
  png_path <- file.path(EXPORT_DIR, png_name)
  jpg_path <- file.path(EXPORT_DIR, jpg_name)
  message("Export: ", scope, " | ", scenario_id, " | ", key)
  export_static_map(
    scenario = scenario_id,
    destination = key,
    output_file = png_path,
    dpi = 300,
    width_in = 13.5,
    height_in = 7.5,
    use_basemap = TRUE,
    iso_data = isochrones,
    pob_pts = pob_pts,
    equip_data = equip_pts,
    espai_pts_data = espai_pts,
    espai_poly_data = espai_poly,
    aparcaments_data = aparcaments,
    www_dir = WWW_DIR,
    out_dir = EXPORT_DIR,
    category_mode = category_mode,
    map_state = default_map_state
  )

  final_name <- png_name
  if (png_to_jpg(png_path, jpg_path)) {
    file.remove(png_path)
    final_name <- jpg_name
  }

  manifest[[idx]] <<- list(
    scope = scope,
    key = key,
    scenario = scenario_id,
    href = paste0("/exports/", final_name)
  )
  idx <<- idx + 1L
}

for (scenario_id in scenarios$id) {
  for (key in destinations$nom) write_one("destination", key, scenario_id, FALSE)
  for (key in category_keys) write_one("category", key, scenario_id, TRUE)
}

jsonlite::write_json(manifest, file.path(EXPORT_DIR, "manifest.json"),
                     auto_unbox = TRUE, pretty = TRUE)
message("Done: ", EXPORT_DIR)
