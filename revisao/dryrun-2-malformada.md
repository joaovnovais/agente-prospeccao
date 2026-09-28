# Dry-run 2 — resposta malformada forçada na 1ª tentativa

- Execução: 2026-09-27T03:25:16.991Z → status **success**
- Modelos: qwen/qwen3.8-27b:free → fallback nvidia/nemotron-3-super-120b-a12b:free
- Malformação forçada na tentativa: 1
- **Nenhum e-mail foi enviado** (dry-run para antes do SMTP).

---

## 1. Dermo Beauty Estética — Goiânia/GO

Nicho: odontologia_estetica · Nota 5 (117 avaliações) · https://maps.google.com/?cid=18100123066654721041&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA

### Tentativas da IA

- Tentativa 1: ❌ rejeitada — [TESTE FORÇADO] resposta não é JSON (texto explicativo antes/no lugar do objeto)

  <details><summary>saída bruta rejeitada</summary>

  ```
  Claro! Aqui está uma sugestão de e-mail para essa empresa:
  
  Olá, tudo bem? Vi que vocês ainda não têm site...
  
  (Espero que ajude!)
  ```
  </details>

- Tentativa 2: ✅ JSON válido (modelo: nvidia/nemotron-3-super-120b-a12b:free)

### E-mails candidatos (Reacher)

- dermobeautyestetica@gmail.com → **safe** ← escolhido
- contato.dermobeautyestetica@gmail.com → **invalid**
- dermobeautyestetica@hotmail.com → **unknown**
- dermobeautyestetica@outlook.com → **unknown**

### E-mail gerado (como seria enviado)

**Assunto:** Presença digital para Dermo Beauty Estética

```text
Olá, vi que a Dermo Beauty Estética em Goiânia ainda não tem site vinculado ao perfil do Google. Isso dificulta que clientes encontrem informações completas ou agendem horários quando pesquisam por vocês online. Com um site profissional e atendimento automatizado por IA, vocês podem aparecer com clareza e receber agendamentos 24h. Gostaria de agendar uma reunião gratuita de 30 minutos para mostrar como isso funciona na prática?

Equipe Novax
novax.ia.br

—
Você recebeu esta mensagem porque Dermo Beauty Estética aparece como empresa no Google Maps em Goiânia/GO. Se não quiser receber novos contatos da Novax, responda com a palavra SAIR e removemos seu e-mail imediatamente.
```

**Desfecho no dry-run:** voltou para a fila (status "novo")

---

## 2. Wanessa Oliveira Clínica de Estética Avançada — Goiânia/GO

Nicho: odontologia_estetica · Nota 5 (55 avaliações) · https://maps.google.com/?cid=12761431429202041191&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA

### Tentativas da IA

- Tentativa 1: ❌ rejeitada — [TESTE FORÇADO] resposta não é JSON (texto explicativo antes/no lugar do objeto)

  <details><summary>saída bruta rejeitada</summary>

  ```
  Claro! Aqui está uma sugestão de e-mail para essa empresa:
  
  Olá, tudo bem? Vi que vocês ainda não têm site...
  
  (Espero que ajude!)
  ```
  </details>

- Tentativa 2: ✅ JSON válido (modelo: nvidia/nemotron-3-super-120b-a12b:free)

### E-mails candidatos (Reacher)

- wanessaoliveiraclinica@gmail.com → **invalid**
- clinicawanessaoliveira@hotmail.com → **unknown**
- contato.wanessaoliveira@outlook.com → **unknown**
- wanessaoliveiraestetica@yahoo.com.br → **unknown**
- clinicaesteticawanessa@gmail.com → **invalid**

### E-mail gerado (como seria enviado)

**Assunto:** Presença digital para clínica de estética em Goiânia

```text
Olá, tudo bem? Vi que a Wanessa Oliveira Clínica de Estética Avançada ainda não tem site vinculado ao perfil do Google, o que dificulta que clientes em Goiânia encontrem informações completas ou agendem horários online. Com um site profissional e atendimento automatizado por IA, sua clínica pode aparecer com mais credibilidade e receber agendamentos 24h, mesmo fora do expediente. Gostaria de convidá-los para uma reunião gratuita de 30 minutos, online, para mostrar como isso funciona na prática. É rápido, sem compromisso e focado em resultados reais para o seu negócio.

Equipe Novax
novax.ia.br

—
Você recebeu esta mensagem porque Wanessa Oliveira Clínica de Estética Avançada aparece como empresa no Google Maps em Goiânia/GO. Se não quiser receber novos contatos da Novax, responda com a palavra SAIR e removemos seu e-mail imediatamente.
```

_Obs.: nenhum candidato "safe" no Reacher — na operação real este lead NÃO receberia e-mail (vira sem_email)._

**Desfecho no dry-run:** {"status":"sem_email","motivo_revisao":"candidatos: wanessaoliveiraclinica@gmail.com=invalid, clinicawanessaoliveira@hotmail.com=unknown, contato.wanessaoliveira@outlook.com=unknown, wanessaoliveiraestetica@yahoo.com.br=unknown, clinicaesteticawanessa@gmail.com=invalid"}

---

## 3. Estética Popular — Goiânia/GO

Nicho: odontologia_estetica · Nota 4.9 (53 avaliações) · https://maps.google.com/?cid=13134159074904548776&g_mp=Cidnb29nbGUubWFwcy5wbGFjZXMudjEuUGxhY2VzLlNlYXJjaFRleHQQAhgEIAA

### Tentativas da IA

- Tentativa 1: ❌ rejeitada — [TESTE FORÇADO] resposta não é JSON (texto explicativo antes/no lugar do objeto)

  <details><summary>saída bruta rejeitada</summary>

  ```
  Claro! Aqui está uma sugestão de e-mail para essa empresa:
  
  Olá, tudo bem? Vi que vocês ainda não têm site...
  
  (Espero que ajude!)
  ```
  </details>

- Tentativa 2: ✅ JSON válido (modelo: nvidia/nemotron-3-super-120b-a12b:free)

### E-mails candidatos (Reacher)

- esteticapopular@gmail.com → **safe** ← escolhido
- contato.esteticapopular@gmail.com → **invalid**
- esteticapopular@outlook.com → **unknown**
- esteticapopular@yahoo.com.br → **unknown**

### E-mail gerado (como seria enviado)

**Assunto:** Presença digital para clínicas em Goiânia

```text
Olá, vi que a Estética Popular tem ótimas avaliações no Google, mas não possui site vinculado ao perfil. Isso dificulta que novos clientes encontrem informações completas ou agendem horários online. Muitas clínicas perdem oportunidades por não terem um canal profissional 24h. A Novax ajuda pequenos negócios a terem site e atendimento automatizado com IA, sem precisar de equipe extra. Podemos marcar uma reunião gratuita de 30 minutos para mostrar como isso funciona na prática?

Equipe Novax
novax.ia.br

—
Você recebeu esta mensagem porque Estética Popular aparece como empresa no Google Maps em Goiânia/GO. Se não quiser receber novos contatos da Novax, responda com a palavra SAIR e removemos seu e-mail imediatamente.
```

**Desfecho no dry-run:** voltou para a fila (status "novo")
