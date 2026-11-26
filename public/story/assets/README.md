# Garden assets

All assets are CC0 (public domain) from [Poly Haven](https://polyhaven.com).
They were downloaded at 1k resolution and optimized for the web: models with
`gltf-transform optimize` (mesh simplification, meshopt compression, WebP
textures), material textures and alpha masks converted to WebP.

Models (`models/`, decoded with the vendored meshopt decoder):
island_tree_02, searsia_lucida, pine_sapling_small, shrub_02, shrub_03, shrub_04,
fern_02, flower_gazania, flower_ursinia, flower_empodium, dandelion_01,
grass_bermuda_01, moss_01, rock_moss_set_01, boulder_01.

Alpha masks (`alpha/`): the 1k glTF colour maps are JPEG and carry no
transparency, so each plant's Poly Haven alpha map is applied at runtime as
`alphaMap` (leaves for island_tree_02, twigs for pine_sapling_small).

Materials (`textures/`, Diffuse, nor_gl and arm maps):
aerial_grass_rock, cliff_side, clay_roof_tiles_02, plastered_stone_wall,
white_plaster_rough_01, wood_planks, mossy_cobblestone.

Sky (`sky/`): qwantani_dusk_2_puresky, 2k HDR.
