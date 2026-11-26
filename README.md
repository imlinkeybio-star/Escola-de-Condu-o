# Escola de Condução Live

Plataforma web multijogador em tempo real de competições sobre o Código de Estrada de Angola, condução defensiva e segurança rodoviária, construída com **Next.js**, **Firebase Authentication**, **Cloud Firestore**, **Google Gemini API** e **Google Cloud / Gemini Text-to-Speech**.

## Arquitetura Principal

- **Sincronização em Tempo Real (`Cloud Firestore`)**: Todas as salas (`/rooms/{roomId}`), participantes (`/participants/{uid}`), perguntas (`/questions/{qIndex}`), respostas (`/answers/{qIndex}_{uid}`) e revelações (`/revealed/{qIndex}`) são sincronizadas em tempo real entre todos os dispositivos conectados.
- **Segurança & Anti-Batota**:
  - As respostas corretas nunca ficam expostas em texto limpo durante a fase `PLAYING` — são seladas no servidor com **AES-256-GCM** (`sealedPayload`) e só são desencriptadas por `/api/competition/reveal-answer` depois de o temporizador oficial do servidor expirar (ou todos os participantes responderem).
  - O temporizador usa timestamps autoritativos do servidor (`/api/time`, `/api/competition/start-round`) e o relógio do Firestore (`request.time <= room.questionEndsAt`).
  - As pontuações nos documentos `participants/{uid}` são validadas matematicamente nas `firestore.rules` cruzando `answers/{qIndex}_{uid}` com `revealed/{qIndex}`.
- **Inteligência Artificial (`gemini-4-hydrogen`)**: Gera perguntas em português utilizado em Angola, explicações educativas e resumo final da competição.
- **Voz em Português (`Cloud TTS` / `gemini-3.8-flash-lite-tts`)**: Lê perguntas, opções, respostas corretas e vencedores sem bloquear a interação do utilizador.

## Instalação Local

1. Instalar dependências:
   ```bash
   npm install
   ```
2. Configurar variáveis de ambiente no servidor (ver `.env.example`):
   - `GEMINI_API_KEY`: Chave da API Gemini (apenas servidor).
   - `APP_URL`: URL da aplicação.
   - `SERVER_SIGNING_SECRET`: Segredo opcional de 32+ bytes para assinatura HMAC/AES.
   - `GOOGLE_CLOUD_TTS_API_KEY`: Chave opcional para Google Cloud Text-to-Speech (usa Gemini TTS automaticamente quando não definida).
3. Ativar fornecedores de autenticação na **Consola Firebase**:
   - **Authentication > Sign-in method**: Google (ativo por defeito) e Email/Password (ativar na consola para registo/login por email).
4. Iniciar em desenvolvimento:
   ```bash
   npm run dev
   ```

## Publicação no Google Cloud Run / Firebase

1. Validar build de produção e regras:
   ```bash
   npm run build
   npx firebase deploy --only firestore:rules,firestore:indexes
   ```
2. Publicar no **Google Cloud Run** (a partir do projeto Next.js com `output: 'standalone'`):
   ```bash
   gcloud run deploy escola-conducao-live \
     --source . \
     --region europe-west3 \
     --allow-unauthenticated \
     --set-env-vars GEMINI_API_KEY=...
   ```
