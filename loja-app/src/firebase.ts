/**
 * Firebase setup — usa o mesmo projeto adegas-pf.
 * AsyncStorage para persistência de auth no React Native.
 */
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey:            'AIzaSyCT3BGvNWRzoOc3mT4lDRRfz6GISptkUzc',
  authDomain:        'adegas-pf.firebaseapp.com',
  projectId:         'adegas-pf',
  storageBucket:     'adegas-pf.firebasestorage.app',
  messagingSenderId: '688042256969',
  appId:             '1:688042256969:web:110f697c3db4ee7b57ed98',
};

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

export const db = getFirestore(app);
export { app };
