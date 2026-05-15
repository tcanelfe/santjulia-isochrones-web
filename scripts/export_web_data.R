# =============================================================================
# export_web_data.R
#
# Creates browser-ready GeoJSON/JSON for the Sant Julià v6 web prototype.
# This script reads ../v6 outputs but writes only inside v6_web_prototype/public/data.
# It does not modify the Shiny app or any v6 source file.
# =============================================================================

required <- c("sf", "dplyr", "jsonlite")
missing <- required[!vapply(required, requireNamespace, logical(1), quietly = TRUE)]
if (length(missing)) {
  stop("Missing packages: ", paste(missing, collapse = ", "),
       "\nInstall them locally, then rerun: install.packages(c(",
       paste(sprintf('"%s"', missing), collapse = ", "), "))")
}

library(sf)
library(dplyr)

# Robust path when run as Rscript scripts/export_web_data.R from prototype root.
args <- commandArgs(trailingOnly = FALSE)
file_arg <- grep("^--file=", args, value = TRUE)
script_dir <- if (length(file_arg)) {
  dirname(normalizePath(sub("^--file=", "", file_arg[[1]])))
} else {
  normalizePath("scripts", mustWork = TRUE)
}
PROTO_DIR <- normalizePath(file.path(script_dir, ".."), mustWork = TRUE)
V6_DIR    <- normalizePath(file.path(PROTO_DIR, "..", "v6"), mustWork = TRUE)
DATA_OUT  <- file.path(PROTO_DIR, "public", "data")
LAYERS_OUT <- file.path(DATA_OUT, "layers")
QA_OUT <- file.path(DATA_OUT, "qa")
dir.create(LAYERS_OUT, recursive = TRUE, showWarnings = FALSE)
dir.create(QA_OUT, recursive = TRUE, showWarnings = FALSE)

# Browser contract choices.
# - Export simplified polygons for fast first paint. The analytical GPKG remains unchanged.
# - Precompute category-union geometries in R; the frontend must not do spatial unions.
# - Export stacked 5/10/15 polygons for now. If visual opacity becomes muddy, export
#   ring geometries as a separate layer in a later iteration.
SIMPLIFY_TOLERANCE_M <- 1.5

source(file.path(V6_DIR, "R", "constants.R"))
source(file.path(V6_DIR, "R", "lib_population.R"))

ISO_PATH <- file.path(V6_DIR, "outputs", "isochrones.gpkg")
POB_PATH <- file.path(V6_DIR, "data", "Poblacio_santju.gpkg")
ESPAI_POLY_PATH <- file.path(V6_DIR, "data", "Espais lliures.gpkg")
APARCAMENTS_PATH <- file.path(V6_DIR, "data", "Aparcaments.gpkg")

write_json <- function(x, path) {
  jsonlite::write_json(x, path, dataframe = "rows", auto_unbox = TRUE,
                       pretty = TRUE, na = "null", digits = 10)
}

normalise_text_cols <- function(x) {
  text_cols <- names(x)[vapply(x, is.character, logical(1))]
  for (nm in text_cols) {
    x[[nm]] <- enc2utf8(x[[nm]])
    # stringi is optional. If available, force NFC to avoid Catalan accent/NFD issues.
    if (requireNamespace("stringi", quietly = TRUE)) {
      x[[nm]] <- stringi::stri_trans_nfc(x[[nm]])
    }
  }
  x
}

simplify_for_web <- function(x, tolerance_m = SIMPLIFY_TOLERANCE_M) {
  x <- normalise_text_cols(x)
  old_s2 <- sf::sf_use_s2(FALSE)
  on.exit(sf::sf_use_s2(old_s2), add = TRUE)
  x <- sf::st_make_valid(x)
  x <- sf::st_simplify(x, dTolerance = tolerance_m, preserveTopology = TRUE)
  sf::st_make_valid(x)
}

write_geojson <- function(x, path, simplify = TRUE) {
  if (file.exists(path)) unlink(path)
  x <- normalise_text_cols(x)
  if (simplify) x <- simplify_for_web(x)
  sf::st_write(sf::st_transform(x, 4326), path, driver = "GeoJSON", quiet = TRUE)
}

message("Reading v6 outputs...")
isochrones <- sf::st_read(ISO_PATH, layer = "isochrones", quiet = TRUE) |> sf::st_make_valid()
crs_analysis <- sf::st_crs(isochrones)
equip <- sf::st_read(ISO_PATH, layer = "equipaments", quiet = TRUE) |> sf::st_transform(crs_analysis)
espai_pts <- sf::st_read(ISO_PATH, layer = "espais_entrades", quiet = TRUE) |> sf::st_transform(crs_analysis)
qa_origins <- sf::st_read(ISO_PATH, layer = "qa_origins", quiet = TRUE) |> sf::st_transform(crs_analysis)
pob_raw <- sf::st_read(POB_PATH, quiet = TRUE) |> sf::st_transform(crs_analysis) |> sf::st_make_valid()
pob_pts <- prepare_population(pob_raw)

# Optional visual layers.
espai_poly <- NULL
if (file.exists(ESPAI_POLY_PATH)) {
  espai_poly <- tryCatch({
    p <- sf::st_read(ESPAI_POLY_PATH, layer = "Espais lliures finals", quiet = TRUE) |>
      sf::st_transform(crs_analysis) |>
      sf::st_make_valid()
    if ("Nom" %in% names(p) && !"nom" %in% names(p)) p <- dplyr::rename(p, nom = Nom)
    if ("Us" %in% names(p) && !"us" %in% names(p)) p <- dplyr::rename(p, us = Us)
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

message("Computing web summaries...")
TOTAL_POB <- sum(pob_pts$persones, na.rm = TRUE)
TOTAL_DONES <- sum(pob_pts$dones, na.rm = TRUE)
TOTAL_HOMES <- sum(pob_pts$homes, na.rm = TRUE)
TOTAL_INFANTS <- sum(pob_pts$infants_0_12, na.rm = TRUE)
TOTAL_JOVES <- sum(pob_pts$joves, na.rm = TRUE)
TOTAL_ADULTS <- sum(pob_pts$adults, na.rm = TRUE)
TOTAL_GENT_GRAN <- sum(pob_pts$gent_gran, na.rm = TRUE)
scenario_denominator <- function(sc) switch(sc,
  older_adults = TOTAL_GENT_GRAN,
  children_0_12 = TOTAL_INFANTS,
  TOTAL_POB
)

pop_per_iso <- cbind(
  sf::st_drop_geometry(isochrones)[, c("nom", "us", "tipus_desti", "n_entrades", "banda_min", "escenari")],
  count_in_polygons(isochrones, pob_pts)
)

destinations <- pop_per_iso |>
  dplyr::select(nom, us, tipus_desti, n_entrades) |>
  dplyr::distinct() |>
  dplyr::arrange(tipus_desti, us, nom)

dest_info <- destinations |> dplyr::select(nom, us, tipus_desti) |> dplyr::distinct()
categories <- sort(unique(dest_info$us))

pop_per_iso$value <- vapply(seq_len(nrow(pop_per_iso)), function(i) {
  sc <- pop_per_iso$escenari[[i]]
  pop_per_iso[[scenario_value_col(sc)]][[i]]
}, numeric(1))
pop_per_iso$denominator <- vapply(pop_per_iso$escenari, scenario_denominator, numeric(1))
pop_per_iso$percentatge <- ifelse(pop_per_iso$denominator > 0,
                                  round(pop_per_iso$value / pop_per_iso$denominator * 100, 1),
                                  NA_real_)

coverage_destination <- pop_per_iso |>
  dplyr::mutate(
    scope = "destination",
    key = nom
  ) |>
  dplyr::select(scope, key, nom, us, escenari, banda_min, persones, dones, homes,
                infants_0_12, joves, adults, gent_gran, denominator, value, percentatge)

message("Computing category union summaries and geometries...")
cat_rows <- list()
cat_geoms <- list()
idx <- 1L
geom_idx <- 1L
old_s2 <- sf::sf_use_s2(FALSE)
for (sc in SCENARIO_IDS) {
  for (cat in categories) {
    noms_cat <- dest_info$nom[dest_info$us == cat]
    for (b in BANDS_MIN) {
      iso_b <- isochrones[isochrones$escenari == sc & isochrones$nom %in% noms_cat & isochrones$banda_min == b, ]
      if (nrow(iso_b) == 0) next
      geom <- sf::st_union(sf::st_geometry(iso_b)) |> sf::st_make_valid()
      poly <- sf::st_sf(scope = "category", key = cat, us = cat,
                        escenari = sc, banda_min = b,
                        geometry = geom, crs = crs_analysis)
      counts <- count_in_polygon(poly, pob_pts)
      value <- counts[[scenario_value_col(sc)]][[1]]
      den <- scenario_denominator(sc)
      cat_rows[[idx]] <- cbind(
        data.frame(scope = "category", key = cat, us = cat, escenari = sc, banda_min = b,
                   denominator = den, value = value,
                   percentatge = ifelse(den > 0, round(value / den * 100, 1), NA_real_)),
        counts
      )
      cat_geoms[[geom_idx]] <- poly
      idx <- idx + 1L
      geom_idx <- geom_idx + 1L
    }
  }
}
sf::sf_use_s2(old_s2)
coverage_category <- dplyr::bind_rows(cat_rows) |>
  dplyr::select(scope, key, us, escenari, banda_min, persones, dones, homes,
                infants_0_12, joves, adults, gent_gran, denominator, value, percentatge)
category_isochrones <- do.call(rbind, cat_geoms)

scenarios <- data.frame(
  id = SCENARIO_IDS,
  label = unname(SCENARIO_LABELS[SCENARIO_IDS]),
  note = unname(SCENARIO_NOTES[SCENARIO_IDS]),
  denominatorLabel = vapply(SCENARIO_IDS, scenario_universe_label, character(1)),
  denominator = vapply(SCENARIO_IDS, scenario_denominator, numeric(1))
)

config <- list(
  projectLabel = PROJECT_LABEL,
  version = VERSION,
  bands = as.integer(BANDS_MIN),
  bandColors = as.list(BAND_COLORS),
  colors = list(
    equipaments = COL_EQUIP,
    espais = COL_ESPAI,
    selected = COL_SELECTED,
    aparcaments = COL_APARCAMENTS
  )
)

message("Writing JSON...")
write_json(config, file.path(DATA_OUT, "config.json"))
write_json(scenarios, file.path(DATA_OUT, "scenarios.json"))
write_json(destinations, file.path(DATA_OUT, "destinations.json"))
write_json(list(
  persones = TOTAL_POB,
  dones = TOTAL_DONES,
  homes = TOTAL_HOMES,
  infants_0_12 = TOTAL_INFANTS,
  joves = TOTAL_JOVES,
  adults = TOTAL_ADULTS,
  gent_gran = TOTAL_GENT_GRAN
), file.path(DATA_OUT, "population_totals.json"))
write_json(coverage_destination, file.path(DATA_OUT, "coverage_by_destination.json"))
write_json(coverage_category, file.path(DATA_OUT, "coverage_by_category.json"))

message("Writing GeoJSON...")
write_geojson(isochrones, file.path(LAYERS_OUT, "isochrones.geojson"), simplify = TRUE)
write_geojson(category_isochrones, file.path(LAYERS_OUT, "isochrones_by_category.geojson"), simplify = TRUE)
write_geojson(equip, file.path(LAYERS_OUT, "equipaments.geojson"), simplify = FALSE)
write_geojson(espai_pts, file.path(LAYERS_OUT, "espais_entrades.geojson"), simplify = FALSE)
write_geojson(qa_origins, file.path(QA_OUT, "qa_origins.geojson"), simplify = FALSE)
if (!is.null(espai_poly)) write_geojson(espai_poly, file.path(LAYERS_OUT, "espais_polygons.geojson"), simplify = TRUE)
if (!is.null(aparcaments)) write_geojson(aparcaments, file.path(LAYERS_OUT, "aparcaments.geojson"), simplify = TRUE)

message("Done: ", DATA_OUT)
