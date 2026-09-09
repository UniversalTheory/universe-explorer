#!/usr/bin/env bash
# Downloads free textures into public/textures.
#  - Solar System Scope textures: CC BY 4.0 (https://www.solarsystemscope.com/textures/)
#  - ESO Milky Way panorama (Serge Brunier): CC BY 4.0 (https://www.eso.org/public/images/eso0932a/)
#  - Milky Way top-down artist's impression (NASA/JPL-Caltech/ESO/R. Hurt): CC BY 4.0 (https://www.eso.org/public/images/eso1339g/)
set -euo pipefail
cd "$(dirname "$0")/.."
OUT=public/textures
mkdir -p "$OUT"
SSS="https://www.solarsystemscope.com/textures/download"

fetch() { # url dest
  local url="$1" dest="$2"
  if [ -s "$dest" ]; then echo "skip  $dest"; return; fi
  echo "fetch $dest"
  curl -sSL --retry 3 -m 600 -o "$dest.part" "$url" && mv "$dest.part" "$dest" || { echo "FAILED $url"; rm -f "$dest.part"; }
}

for f in \
  2k_sun.jpg \
  2k_mercury.jpg 8k_mercury.jpg \
  2k_venus_surface.jpg 4k_venus_atmosphere.jpg \
  2k_earth_daymap.jpg 8k_earth_daymap.jpg \
  2k_earth_nightmap.jpg 8k_earth_nightmap.jpg \
  2k_earth_clouds.jpg 8k_earth_clouds.jpg \
  2k_moon.jpg 8k_moon.jpg \
  2k_mars.jpg 8k_mars.jpg \
  2k_jupiter.jpg 8k_jupiter.jpg \
  2k_saturn.jpg 8k_saturn.jpg 2k_saturn_ring_alpha.png \
  2k_uranus.jpg 2k_neptune.jpg \
  2k_ceres_fictional.jpg 2k_eris_fictional.jpg 2k_haumea_fictional.jpg 2k_makemake_fictional.jpg \
  8k_stars_milky_way.jpg ; do
  fetch "$SSS/$f" "$OUT/$f"
done

# ESO Milky Way panorama, galactic coordinates, galactic centre at image centre.
fetch "https://cdn.eso.org/images/large/eso0932a.jpg" "$OUT/eso_milky_way.jpg"

echo "done"

# Top-down Milky Way artwork for the optional map plane (1024 px "screen" size, 200 KB).
fetch "https://cdn.eso.org/images/screen/eso1339g.jpg" "$OUT/eso1339g_milky_way_map.jpg"
