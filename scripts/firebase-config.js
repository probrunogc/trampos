/**
 * CONFIG DO FIREBASE
 * ==================================================================
 * 1) Acesse https://console.firebase.google.com/
 * 2) Crie um projeto (nome sugerido: "emporio-das-bebidas")
 * 3) Adicione um "App Web" e copie o objeto firebaseConfig
 * 4) COLE os valores abaixo substituindo os placeholders
 * 5) Habilite no Console:
 *    - Authentication > Sign-in method > E-mail/Senha
 *    - Firestore Database > Criar banco > modo de produção (regras virão do firestore.rules)
 * 6) Crie um usuário admin no Authentication, depois crie no Firestore:
 *    Coleção: users
 *    Doc ID:  <UID do usuário criado>
 *    Campos:  { name: "Admin", email: "...", role: "admin", active: true, createdAt: <timestamp> }
 *
 * Após isso o sistema vai logar normalmente.
 * ==================================================================
 */

export const firebaseConfig = {
  apiKey:            "REPLACE_API_KEY",
  authDomain:        "REPLACE_AUTH_DOMAIN",
  projectId:         "REPLACE_PROJECT_ID",
  storageBucket:     "REPLACE_STORAGE_BUCKET",
  messagingSenderId: "REPLACE_SENDER_ID",
  appId:             "REPLACE_APP_ID"
};

/**
 * MODO DEMO
 * ---------
 * Se quiser rodar SEM Firebase (apenas vendo a UI funcionando local),
 * deixe `true` aqui. Os dados ficam no localStorage. Útil para
 * desenvolvimento. EM PRODUÇÃO, deixe false e configure o Firebase acima.
 */
export const DEMO_MODE = true;
