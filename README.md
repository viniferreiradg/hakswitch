# HakSwitch

Frontend customizado pra Nintendo Switch homebrew que transforma o RetroArch num
launcher estilo "console" - carrossel por console, capas, metadados, sem menu padrão
do RetroArch aparecendo pro usuário final.

## Estrutura

- **`retroarch/`** - fork modificado do [libretro/RetroArch](https://github.com/libretro/RetroArch).
  A UI custom (carrossel, navegação por pasta, cover art, BGM) vive principalmente em
  `menu/drivers/ozone.c`, `menu/cbs/menu_cbs_ok.c` e `menu/menu_displaylist.c` -
  procure por identificadores `hakswitch`/`HAKSWITCH` pra achar as modificações.
  Compilado via devkitPro/libnx pra gerar o `hakswitch.nro`.

- **`studio/`** - HakSwitch Studio, app Electron/React/TS que serve de curador da
  biblioteca de jogos (importar ROMs, buscar metadados, gerenciar arte por console) e
  gera o pacote entregável completo (botão "Gerar Biblioteca").

- **`shared/`** - schema SQLite compartilhado pelo Studio (`shared/schema/schema.sql`).

- **`template/`** - documenta o formato do pacote entregável. O conteúdo de verdade
  (ROMs, capas, cores compilados) fica em `template/local-data/`, fora do controle de
  versão - ver `template/README.md`.

## O que nunca vai pro git

ROMs, capas de jogos, música/sfx de terceiros, `.nro` compilados, `prod.keys` e
qualquer `.nsp` gerado. Ver `.gitignore`. Chaves do console (`prod.keys`) e
ferramentas de terceiros (Lockpick_RCM) ficam fora até da pasta do repositório, em
`C:\Users\Vini\hakswitch-secrets\`.

## Fluxo de trabalho

1. Editar/testar o fork em `retroarch/`, compilar com devkitPro/libnx.
2. Usar o `studio/` pra curar a biblioteca local e gerar o pacote em
   `template/local-data/`.
3. Copiar `template/local-data/{hakswitch.nro→switch/, resto→retroarch/}` pro SD card.
