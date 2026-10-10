# usage-band

Mod do Claude Code: uma barra mínima logo acima do prompt com o uso da sessão.

```
 ◐ contexto ━━━━━━━━   8%  │ ⏱ sessão 5h ━━━━━━━━   7% ↻ 4h 31m  │ ▦ semana ━━━━━━━━   2% ↻ 2d 18h  │ ✦ skills 2 · tdd, research      esconder
```

- **contexto**: quanto da janela de contexto da sessão está em uso.
- **sessão 5h**: janela de limite de 5 horas do plano, com tempo até o reset.
- **semana**: janela de 7 dias, idem.
- **skills**: quantas skills distintas foram chamadas nesta sessão e as últimas três.

As barras ficam verdes até 70%, amarelas até 90% e vermelhas acima. Em terminais com menos de 110 colunas os resets e os nomes de skills são omitidos. Os limites só aparecem após a primeira resposta da API e apenas em planos de assinatura.

## Instalar

No prompt de uma sessão do Claude Code no terminal:

```
/plugin install usage-band --marketplace GabrielL915/claude-usage-band
```

Responda `y` para adicionar o marketplace e escolha o escopo (`user` vale para todas as sessões).

## Usar

- `/barra` alterna entre mostrar e esconder a barra.
- `/barra show` e `/barra hide` (ou `on`/`off`) forçam o estado.
- O botão **esconder** à direita faz o mesmo: clique, ou foque a barra com `ctrl+x tab` e aperte `h`.
- O estado escondido persiste entre sessões.

Em qualquer caso o comando imprime um resumo em texto:

```
Barra de uso visível (/barra alterna). contexto 8% · sessão 5h 7% · semana 2% · skills 0
```

## Desenvolver

```
claude plugin validate .
claude plugin test .
claude --plugin-dir .
```

Com o mod carregado uma vez, `tsc -p .` faz o type-check contra os tipos que o engine escreve em `.claude-plugin/types/`.

## Licença

MIT
