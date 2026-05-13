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
  apiKey:            "AIzaSyCT3BGvNWRzoOc3mT4LDRRfz6GISptkUzc",
  authDomain:        "adegas-pf.firebaseapp.com",
  projectId:         "adegas-pf",
  storageBucket:     "adegas-pf.firebasestorage.app",
  messagingSenderId: "688042256969",
  appId:             "1:688042256969:web:110f697c3db4ee7b57ed98"
};

/**
 * MODO DEMO
 * ---------
 * Se quiser rodar SEM Firebase (apenas vendo a UI funcionando local),
 * deixe `true` aqui. Os dados ficam no localStorage. Útil para
 * desenvolvimento. EM PRODUÇÃO, deixe false e configure o Firebase acima.
 *
 * IMPORTANTE: Antes de virar `false`, você precisa:
 *   1. Habilitar Authentication (E-mail/Senha) no Firebase Console
 *   2. Criar o Firestore Database
 *   3. Criar pelo menos 1 usuário admin (instruções no README)
 */
export const DEMO_MODE = true;
