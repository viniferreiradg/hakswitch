# template/

Documenta o formato do pacote entregável que o HakSwitch Studio gera (`Gerar
Biblioteca`) e que vai pro SD card do Switch.

## local-data/ (não versionado)

`local-data/` tem o conteúdo real usado como fonte pelo Studio ao gerar o pacote -
ROMs, capas, cores compilados (`.nro`), música/sfx, o `hakswitch.nro` do launcher.
Nada disso entra no git (ROMs e capas são material protegido por direito autoral,
os binários são grandes e reproduzíveis a partir de `../retroarch/`). Fica só local,
no disco.

Estrutura esperada dentro de `local-data/`:

```
local-data/
├── hakswitch.nro              launcher (compilado a partir de ../retroarch/)
├── cores/                     cores .nro (fceumm/snes9x/genesis_plus_gx)
├── info/                      *.info de cada core
├── assets/ozone/sounds/       assets do menu ozone
├── icons/                     icones dos botoes (A/B/X/Y, esquerda/direita)
├── sfx/                       efeitos sonoros do carrossel
├── music/                     musica de fundo do carrossel
├── src/                       capa placeholder (jogo sem capa)
└── consoles/
    └── <Nome do Console>/     ex: "Mega Drive", "Super Nintendo"
        ├── roms/
        ├── capas/             mesmo nome-base da rom (ex: "Sonic 2.jpg" p/ "Sonic 2.md")
        ├── metadata/          mesmo nome-base, .json {name,description,year,region}
        ├── logo/
        ├── background/
        └── screenshots/
```

## No SD card do Switch

O pacote gerado espelha `local-data/` direto:
- `sdmc:/switch/hakswitch.nro`
- `sdmc:/retroarch/{cores,info,assets,icons,sfx,music,src,consoles}`

Ver `../retroarch/menu/menu_displaylist.c` (`hakswitch_init_paths`) e
`../retroarch/menu/drivers/ozone.c` (`hakswitch_get_game_cover`) pra como o `.nro`
lê essa estrutura em runtime.
