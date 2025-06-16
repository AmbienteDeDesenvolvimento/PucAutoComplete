# PUC Auto Complete

Automatize tarefas repetitivas no Canvas da PUC Minas com esta extensão para Google Chrome!

![Como carregar a extensão](help/carregar_extensao.png)

## Objetivo

Este projeto foi criado para automatizar tarefas chatas e repetitivas enfrentadas durante a pós-graduação em Engenharia de Software na PUC Minas. Com ele, você pode marcar atividades como concluídas e baixar vídeos das aulas de forma simples e rápida, diretamente pela interface do Canvas.

## Instalação

1. Baixe ou clone este repositório para o seu computador.
2. Acesse `chrome://extensions/` no Google Chrome.
3. Ative o **Modo do desenvolvedor** no canto superior direito.
4. Clique em **Carregar sem compactação** e selecione a pasta do projeto.
5. Pronto! A extensão estará ativa.

![Funcionamento da extensão](help/funcionamento_extensao.png)

## Como usar

1. Entre na página da matéria no Canvas da PUC Minas.
2. Aguarde o carregamento completo da página (a extensão só carrega após tudo estar pronto).
3. Dois ícones aparecerão ao lado de cada atividade:
   - **Ícone de download**: baixa o vídeo da atividade (se houver).
   - **Ícone de check**: marca ou desmarca a atividade como concluída no sistema.

## Funcionalidades

- **Download de vídeos**: Baixe rapidamente os vídeos das aulas com um clique, sem precisar abrir o player ou procurar o link do arquivo.
- **Marcar como concluído**: Automatize o processo de marcar atividades como feitas. A extensão abre a página da atividade em segundo plano, clica automaticamente no botão "Marcar como feito" e fecha a aba, mantendo o foco na sua navegação.

## Detalhes Técnicos

### Download de Vídeos
- Ao clicar no ícone de download, a extensão abre a página da atividade em segundo plano, localiza o vídeo MP4 e inicia o download automaticamente usando a API de downloads do Chrome.
- O arquivo é salvo com o nome da atividade, facilitando a organização dos conteúdos.

### Marcar Atividade como Concluída
- Ao clicar no ícone de check, a extensão abre a página da atividade em uma nova aba (sem foco), localiza o botão de id `mark-as-done-checkbox` e clica nele automaticamente.
- Após marcar como feito, a aba é fechada e a página principal é recarregada para refletir o novo status da atividade.

## Créditos

Desenvolvido por **Paulo Sérgio Júnior** durante a pós-graduação em Engenharia de Software na PUC Minas.

---

Se este projeto te ajudou, deixe uma estrela no repositório! ⭐ 