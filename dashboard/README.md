# Robson — Painel de Prospecção

Dashboard Streamlit somente-leitura com o status real do agente de prospecção
(Robson): funil de leads, envios reais por dia, taxa de resposta, cota de IA
usada e leads pendentes de revisão manual. Fonte de dados: Supabase (projeto
`novax-clinica-demo`), tabelas `prospeccao_leads`, `prospeccao_envios` e
`prospeccao_uso_api`.

Vive como subpasta dentro do repositório `agente-prospeccao` (mesmo produto,
código do workflow em `../workflow`).

## Rodar localmente

```
cd dashboard
pip install -r requirements.txt
cp .streamlit/secrets.toml.example .streamlit/secrets.toml
# edite .streamlit/secrets.toml com a service_role key do projeto Supabase
streamlit run app.py
```

## Deploy (Streamlit Community Cloud)

1. Repositório já está no GitHub (`joaovnovais/agente-prospeccao`).
2. Em share.streamlit.io, conecte esse repositório e aponte o **main file path**
   para `dashboard/app.py` (não `app.py` — o app vive na subpasta).
3. Em **App settings → Secrets**, cole o conteúdo de `.streamlit/secrets.toml.example`
   já preenchido com a `service_role_key` real (nunca comitar essa chave no repo).
4. Em **App settings → Sharing**, deixe como **"Only specific people can view this app"**
   e adicione só o seu e-mail — os dados são reais (leads, e-mails, respostas),
   não é o dashboard de marketing público.

O painel consulta o Supabase direto a cada carregamento (cache de 15 min), então
reflete o estado real sem precisar rodar nada manualmente todo dia.
