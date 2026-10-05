import streamlit as st
import pandas as pd
import plotly.express as px
from supabase import create_client
from datetime import datetime
import hmac
import pytz

st.set_page_config(page_title="Robson - Painel de Prospeccao", page_icon="📈", layout="wide")


def exigir_senha():
    """Trava fail-closed: sem [painel] senha nos Secrets, o painel não carrega dado nenhum.
    O app usa a service_role (acesso total ao projeto Supabase, inclusive tabelas da Claudia)."""
    senha_cfg = st.secrets.get("painel", {}).get("senha")
    if not senha_cfg:
        st.error("Painel bloqueado: defina [painel] senha nos Secrets do Streamlit.")
        st.stop()
    if st.session_state.get("autenticado"):
        return
    with st.form("login"):
        senha = st.text_input("Senha do painel", type="password")
        if st.form_submit_button("Entrar"):
            if hmac.compare_digest(senha.encode(), str(senha_cfg).encode()):
                st.session_state["autenticado"] = True
                st.rerun()
            st.error("Senha incorreta.")
    st.stop()


exigir_senha()

TZ = pytz.timezone("America/Sao_Paulo")
COTA_IA_DIARIA = 45
RAMP_UP_SEMANAS = [5, 10, 15, 18, 20]
ORDEM_STATUS = [
    "novo", "sem_email", "email_enviado", "respondeu",
    "reuniao_agendada", "fechado", "revisao_manual", "perdido", "descartado",
]


@st.cache_resource
def get_client():
    return create_client(
        st.secrets["supabase"]["url"],
        st.secrets["supabase"]["service_role_key"],
    )


@st.cache_data(ttl=900)  # 15 min - dá pra abrir o painel a qualquer hora sem esperar
def carregar_dados():
    sb = get_client()
    leads = sb.table("prospeccao_leads").select("*").execute().data
    envios = sb.table("prospeccao_envios").select("*").execute().data
    uso = sb.table("prospeccao_uso_api").select("*").execute().data
    return pd.DataFrame(leads), pd.DataFrame(envios), pd.DataFrame(uso)


df_leads, df_envios, df_uso = carregar_dados()

st.title("📈 Robson — Painel de Prospecção")
col_a, col_b = st.columns([4, 1])
col_a.caption(
    f"Dados direto do Supabase (novax-clinica-demo) · cache de 15 min · "
    f"consultado em {datetime.now(TZ).strftime('%d/%m/%Y %H:%M')} (Brasília)"
)
if col_b.button("🔄 Atualizar agora"):
    st.cache_data.clear()
    st.rerun()

hoje = datetime.now(TZ).date()
envios_reais = df_envios[df_envios["teste"] == False].copy() if not df_envios.empty else df_envios.copy()

total_leads = len(df_leads)
total_envios_reais = len(envios_reais)
total_respostas = int(envios_reais["resposta_recebida_em"].notna().sum()) if not envios_reais.empty else 0
taxa_resposta = (total_respostas / total_envios_reais * 100) if total_envios_reais else 0.0
reunioes_agendadas = int((df_leads["status"] == "reuniao_agendada").sum()) if not df_leads.empty else 0
revisao_manual_qtd = int((df_leads["status"] == "revisao_manual").sum()) if not df_leads.empty else 0

cota_hoje = 0
if not df_uso.empty:
    linha = df_uso[(df_uso["servico"] == "openrouter") & (df_uso["periodo"] == str(hoje))]
    if not linha.empty:
        cota_hoje = int(linha["chamadas"].iloc[0])

c1, c2, c3, c4, c5 = st.columns(5)
c1.metric("Leads captados", total_leads)
c2.metric("E-mails reais enviados", total_envios_reais)
c3.metric("Taxa de resposta", f"{taxa_resposta:.0f}%")
c4.metric("Reuniões agendadas", reunioes_agendadas)
c5.metric("Cota de IA hoje", f"{cota_hoje}/{COTA_IA_DIARIA}")

st.divider()

st.subheader("Funil de leads")
if not df_leads.empty:
    funil = df_leads["status"].value_counts().reindex(ORDEM_STATUS).fillna(0).reset_index()
    funil.columns = ["status", "quantidade"]
    fig = px.bar(funil, x="status", y="quantidade", text="quantidade", color="status")
    fig.update_layout(showlegend=False, xaxis_title="", yaxis_title="Leads")
    st.plotly_chart(fig, use_container_width=True)
else:
    st.info("Nenhum lead na base ainda.")

st.divider()

st.subheader("Envios reais por dia")
if not envios_reais.empty:
    envios_reais["dia"] = pd.to_datetime(envios_reais["enviado_em"], utc=True).dt.tz_convert(TZ).dt.date
    por_dia = (
        envios_reais.groupby("dia")
        .agg(envios=("id", "count"), respostas=("resposta_recebida_em", lambda s: s.notna().sum()))
        .reset_index()
        .sort_values("dia")
    )
    fig2 = px.bar(por_dia, x="dia", y="envios", text="envios")
    fig2.add_scatter(x=por_dia["dia"], y=por_dia["respostas"], mode="lines+markers", name="respostas")
    st.plotly_chart(fig2, use_container_width=True)
    st.dataframe(por_dia, use_container_width=True, hide_index=True)
    st.caption(f"Teto do ramp-up por semana de envio: {RAMP_UP_SEMANAS} e-mails/dia.")
else:
    st.info("Nenhum envio real registrado ainda (só testes, com `teste = true`).")

st.divider()

st.subheader("Leads em revisão manual")
if revisao_manual_qtd > 0:
    tabela = df_leads[df_leads["status"] == "revisao_manual"][
        ["nome", "cidade", "motivo_revisao", "updated_at"]
    ].sort_values("updated_at", ascending=False)
    st.dataframe(tabela, use_container_width=True, hide_index=True)
else:
    st.success("Nenhum lead pendente de revisão manual agora.")

st.divider()
st.caption(
    "Fonte: Supabase, tabelas prospeccao_leads / prospeccao_envios / prospeccao_uso_api. "
    "Não inclui dados do Trello nem do Google Calendar."
)
