# 🎄 Amigo Oculto — Lista de Presentes da Família

Site simples, leve e responsivo (feito para abrir direto do WhatsApp no celular) para toda a família cadastrar suas preferências de presentes de Natal em um único lugar.

## ✨ O que ele tem
- Cadastro rápido com **nome**, **tamanhos (roupa/calçado)**, **ideias de presentes (com link opcional)** e **o que evitar**.
- **PIN opcional de 4 dígitos** em cada lista para ninguém alterar a lista do outro sem querer.
- **Busca instantânea** por nome ou presente.
- **Botão de compartilhar no WhatsApp** com o link pronto.
- **Zero build**: apenas HTML, CSS e JS puros — pronto para o **GitHub Pages**.

---

## 1) Conectar uma Planilha do Google como banco gratuito (2 minutos)

Assim, o que qualquer pessoa da família cadastrar no celular dela fica salvo na sua planilha e aparece para todo mundo no mesmo link!

1. Crie uma nova planilha em [sheets.new](https://sheets.new) (por exemplo, `Amigo Oculto da Família`).
2. No menu superior da planilha, clique em **Extensões** → **Apps Script**.
3. Apague o código padrão que aparecer e cole todo o conteúdo do arquivo [`google-apps-script.gs`](google-apps-script.gs). Clique em **Salvar** (ícone de disquete).
4. No canto superior direito, clique em **Implantar** → **Nova implantação**.
5. Clique na engrenagem ao lado de "Selecionar tipo" e escolha **App da Web**.
   - **Executar como:** `Eu` (sua conta Google)
   - **Quem pode acessar:** `Qualquer pessoa`
6. Clique em **Implantar**, autorize as permissões da sua conta Google (se aparecer "App não verificado", clique em *Avançado → Acessar projeto*) e copie a **URL do app da Web** gerada (ela termina em `/exec`).
7. Abra o arquivo [`config.js`](config.js) e cole a URL em `googleScriptUrl`:
   ```js
   window.APP_CONFIG = {
     familyTitle: "Amigo Oculto — Lista de Presentes",
     subtitle: "Já fizemos o sorteio! Agora deixe suas dicas...",
     priceHint: "Valor sugerido: R$ 80 a R$ 150", // opcional
     googleScriptUrl: "https://script.google.com/macros/s/SEU-CODIGO/exec",
     supabaseUrl: "",
     supabaseAnonKey: "",
   };
   ```

> *(Opcional)* Se preferir usar **Supabase** em vez de Google Sheets, basta preencher `supabaseUrl` e `supabaseAnonKey` com o script [`supabase-setup.sql`](supabase-setup.sql). Enquanto ambos estiverem vazios, o site roda em **Modo Demonstração (Local)**.

---

## 2) Publicar no GitHub Pages

1. Crie um repositório no GitHub (por exemplo, `lista-de-presentes`).
2. Envie os arquivos desta pasta para o repositório (`branch main`):
   ```bash
   git init -b main
   git add .
   git commit -m "Mural de presentes do amigo oculto"
   git remote add origin https://github.com/SEU-USUARIO/lista-de-presentes.git
   git push -u origin main
   ```
3. No GitHub, abra o repositório e vá em **Settings** → **Pages**.
4. Em **Build and deployment** → **Source**, escolha **Deploy from a branch**, selecione `main` e `/ (root)`, e clique em **Save**.
5. Em cerca de 1 minuto o link `https://SEU-USUARIO.github.io/lista-de-presentes/` estará no ar para fixar no grupo da família! 🎁
