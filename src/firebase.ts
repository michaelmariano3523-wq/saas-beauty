import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer, setDoc, serverTimestamp, getDocs, collection, updateDoc } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

// Function to create/update user document in Firestore
export const createUserDocument = async (user: any, additionalData: any = {}) => {
  if (!user) return;
  
  const userRef = doc(db, 'users', user.uid);
  const snapshot = await getDocFromServer(userRef);
  
  if (!snapshot.exists()) {
    const { email, displayName } = user;
    try {
      // Create user doc with a shopId (use uid as shopId for simplicity)
      await setDoc(userRef, {
        uid: user.uid,
        email,
        displayName: displayName || '',
        role: 'owner', // default role
        isAdmin: false,
        shopId: user.uid, // Use uid as shopId
        createdAt: serverTimestamp(),
        ...additionalData
      });
      console.log('User document created with shopId:', user.uid);
    } catch (error) {
      console.error('Error creating user document:', error);
    }
  } else {
    // Update shopId if missing
    const data = snapshot.data();
    if (!data.shopId) {
      await setDoc(userRef, { shopId: user.uid }, { merge: true });
      console.log('Updated user with shopId:', user.uid);
    }
  }

  // Auto-create shop document if it doesn't exist
  await createShopIfNotExists(user);
};

// Auto-create shop document with user's UID
export const createShopIfNotExists = async (user: any) => {
  if (!user?.uid) return;
  
  try {
    const shopRef = doc(db, 'shops', user.uid);
    const shopSnap = await getDocFromServer(shopRef);
    
    if (!shopSnap.exists()) {
      await setDoc(shopRef, {
        name: 'Minha Barbearia',
        ownerId: user.uid,
        uid: user.uid,
        email: user.email,
        status: 'active',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      console.log('Shop auto-created for user:', user.uid);
    }
  } catch (error) {
    console.error('Error creating shop:', error);
  }
};

// Ensure shop document exists - simplified to not block app
export const ensureShopExists = async (user: any) => {
  if (!user?.uid) return null;
  
  try {
    // Just ensure user has a shop with correct ownerId
    const shopRef = doc(db, 'shops', user.uid);
    const shopSnap = await getDocFromServer(shopRef);
    
    if (!shopSnap.exists()) {
      await setDoc(shopRef, {
        name: 'Minha Barbearia',
        ownerId: user.uid,
        uid: user.uid,
        email: user.email,
        status: 'active',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      console.log('Created shop for user:', user.uid);
    } else {
      const data = shopSnap.data();
      if (!data.ownerId || !data.uid) {
        await updateDoc(shopRef, {
          ownerId: user.uid,
          uid: user.uid,
          updatedAt: serverTimestamp()
        });
      }
    }
    return user.uid;
  } catch (error) {
    console.error('Error ensuring shop exists:', error);
    return user.uid; // Return uid anyway so app can try to work
  }
};

// Helper function to get shopId (creates if doesn't exist)
export const getShopId = async (user: any) => {
  if (!user?.uid) return '';
  
  const userRef = doc(db, 'users', user.uid);
  const snapshot = await getDocFromServer(userRef);
  
  if (snapshot.exists()) {
    const data = snapshot.data();
    if (data.shopId) return data.shopId;
  }
  
  // Create if doesn't exist
  await createUserDocument(user);
  return user.uid;
};

export const loginWithEmail = (email: string, password: string) => 
  signInWithEmailAndPassword(auth, email, password);
export const registerWithEmail = (email: string, password: string) => 
  createUserWithEmailAndPassword(auth, email, password);
export const logout = () => signOut(auth);

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration.");
    }
  }
}
testConnection();
