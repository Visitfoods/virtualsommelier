import { mainDb } from './mainConfig';
import { collection, addDoc, getDocs, doc, updateDoc, getDoc, query, where, deleteDoc } from 'firebase/firestore';
import bcrypt from 'bcryptjs';

// Interface para utilizadores
export interface User {
  id?: string;
  username: string;
  email: string;
  password: string;
  role: 'user' | 'admin';
  active: boolean;
  description: string;
  guideSlug?: string | null;
  createdAt: string;
  updatedAt: string;
}

// Listar todos os utilizadores
export const listUsers = async (): Promise<User[]> => {
  try {
    const querySnapshot = await getDocs(collection(mainDb, 'users'));
    const users: User[] = [];
    
    querySnapshot.forEach((doc) => {
      users.push({
        id: doc.id,
        ...doc.data()
      } as User);
    });
    
    // Ordenar por role (admin primeiro) e depois por username
    users.sort((a, b) => {
      if (a.role === b.role) {
        return a.username.localeCompare(b.username);
      }
      return a.role === 'admin' ? -1 : 1;
    });
    
    return users;
  } catch (error) {
    console.error('Erro ao listar utilizadores:', error);
    throw error;
  }
};

// Validar credenciais de login
export async function validateUserCredentials(username: string, password: string): Promise<{ isValid: boolean; user?: Record<string, unknown>; error?: string }> {
  try {
    const usersRef = collection(mainDb, 'users');
    const q = query(usersRef, where('username', '==', username));
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      return { isValid: false, error: 'Utilizador não encontrado' };
    }
    
    const userDoc = querySnapshot.docs[0];
    const userData = userDoc.data();
    
    if (!userData.active) {
      return { isValid: false, error: 'Conta desativada' };
    }
    
    const isPasswordValid = await bcrypt.compare(password, userData.password);
    
    if (isPasswordValid) {
      return { isValid: true, user: { id: userDoc.id, ...userData } };
    } else {
      return { isValid: false, error: 'Password incorreta' };
    }
  } catch (error) {
    console.error('Erro ao validar credenciais:', error);
    return { isValid: false, error: 'Erro interno do servidor' };
  }
}

// Criar novo utilizador
export const createUser = async (userData: Omit<User, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
  try {
    // Verificar se o username já existe
    const q = query(collection(mainDb, 'users'), where('username', '==', userData.username));
    const existingUser = await getDocs(q);
    
    if (!existingUser.empty) {
      throw new Error('Nome de utilizador já existe');
    }
    
    // Hash da password
    const hashedPassword = await bcrypt.hash(userData.password, 10);
    
    const userWithTimestamps = {
      ...userData,
      password: hashedPassword,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    const docRef = await addDoc(collection(mainDb, 'users'), userWithTimestamps);
    return docRef.id;
  } catch (error) {
    console.error('Erro ao criar utilizador:', error);
    throw error;
  }
};

// Criar utilizador simples (registo sem password) no projeto principal
// Será criado como inativo (active=false) para evitar que participe no fluxo de login
export const createUserRegistration = async (
  data: { 
    username: string; 
    email: string; 
    password: string; 
    description: string;
    role: 'user' | 'admin'; 
    guideSlug?: string | null 
  }
): Promise<string> => {
  try {
    // Verificar se o username já existe (independentemente de estar ativo)
    const usernameQuery = query(collection(mainDb, 'users'), where('username', '==', data.username));
    const existingUsername = await getDocs(usernameQuery);
    if (!existingUsername.empty) {
      throw new Error('Nome de utilizador já existe');
    }

    // Verificar se o email já existe (independentemente de estar ativo)
    const emailQuery = query(collection(mainDb, 'users'), where('email', '==', data.email));
    const existingEmail = await getDocs(emailQuery);
    if (!existingEmail.empty) {
      throw new Error('Email já existe');
    }

    // Hash da password
    const hashedPassword = await bcrypt.hash(data.password, 10);

    const docRef = await addDoc(collection(mainDb, 'users'), {
      username: data.username,
      password: hashedPassword,
      email: data.email,
      role: data.role,
      active: true,
      description: data.description,
      guideSlug: data.role === 'user' ? (data.guideSlug || null) : null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    } as any);

    return docRef.id;
  } catch (error) {
    console.error('Erro ao registar utilizador:', error);
    throw error;
  }
};

// Atualizar utilizador
export const updateUser = async (userId: string, updates: Partial<Omit<User, 'id' | 'createdAt'>>): Promise<void> => {
  try {
    const userRef = doc(mainDb, 'users', userId);
    
    // Se estiver a atualizar o username, verificar se já existe
    if (updates.username) {
      const usernameQuery = query(collection(mainDb, 'users'), where('username', '==', updates.username));
      const existingUsername = await getDocs(usernameQuery);
      
      // Verificar se existe e não é o próprio utilizador
      if (!existingUsername.empty && existingUsername.docs[0].id !== userId) {
        throw new Error('Nome de utilizador já existe');
      }
    }

    // Se estiver a atualizar o email, verificar se já existe
    if (updates.email) {
      const emailQuery = query(collection(mainDb, 'users'), where('email', '==', updates.email));
      const existingEmail = await getDocs(emailQuery);
      
      // Verificar se existe e não é o próprio utilizador
      if (!existingEmail.empty && existingEmail.docs[0].id !== userId) {
        throw new Error('Email já existe');
      }
    }
    
    // Prevenir desativação do último admin ativo
    if (typeof updates.active === 'boolean' && updates.active === false) {
      const currentDoc = await getDoc(userRef);
      if (!currentDoc.exists()) {
        throw new Error('Utilizador não encontrado');
      }
      const currentData = currentDoc.data() as User;
      if (currentData.role === 'admin' && currentData.active === true) {
        const activeAdminsSnap = await getDocs(
          query(collection(mainDb, 'users'), where('role', '==', 'admin'), where('active', '==', true))
        );
        if (activeAdminsSnap.size <= 1) {
          throw new Error('Não é possível desativar o último utilizador admin.');
        }
      }
    }
    
    const updateData = {
      ...updates,
      updatedAt: new Date().toISOString()
    };
    
    await updateDoc(userRef, updateData);
  } catch (error) {
    console.error('Erro ao atualizar utilizador:', error);
    throw error;
  }
};

// Obter utilizador por ID
export const getUser = async (userId: string): Promise<User | null> => {
  try {
    const userRef = doc(mainDb, 'users', userId);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      return null;
    }
    
    return {
      id: userDoc.id,
      ...userDoc.data()
    } as User;
  } catch (error) {
    console.error('Erro ao obter utilizador:', error);
    throw error;
  }
};

// Alternar estado ativo/inativo do utilizador
export const toggleUserActive = async (userId: string): Promise<void> => {
  try {
    const userRef = doc(mainDb, 'users', userId);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      throw new Error('Utilizador não encontrado');
    }
    
    const currentData = userDoc.data() as User;

    // Se for admin e estiver ativo, impedir que fique inativo se for o último admin ativo
    if (currentData.role === 'admin' && currentData.active === true) {
      const activeAdminsSnap = await getDocs(
        query(collection(mainDb, 'users'), where('role', '==', 'admin'), where('active', '==', true))
      );
      if (activeAdminsSnap.size <= 1) {
        throw new Error('Não é possível desativar o último utilizador admin.');
      }
    }
    await updateDoc(userRef, {
      active: !currentData.active,
      updatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Erro ao alternar estado do utilizador:', error);
    throw error;
  }
};

// Alterar password do utilizador
export const changeUserPassword = async (userId: string, newPassword: string): Promise<void> => {
  try {
    // Hash da nova password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    const userRef = doc(mainDb, 'users', userId);
    await updateDoc(userRef, {
      password: hashedPassword,
      updatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Erro ao alterar password:', error);
    throw error;
  }
};

// Eliminar utilizador
export const deleteUser = async (userId: string): Promise<void> => {
  try {
    const userRef = doc(mainDb, 'users', userId);
    
    // Verificar se o utilizador existe antes de eliminar
    const userDoc = await getDoc(userRef);
    if (!userDoc.exists()) {
      throw new Error('Utilizador não encontrado');
    }
    
    // Prevenir eliminação do último administrador
    const userData = userDoc.data() as User;
    if (userData?.role === 'admin') {
      const adminsSnap = await getDocs(query(collection(mainDb, 'users'), where('role', '==', 'admin')));
      const adminCount = adminsSnap.size;
      if (adminCount <= 1) {
        throw new Error('Não é possível eliminar o último utilizador admin.');
      }
    }
    
    await deleteDoc(userRef);
  } catch (error) {
    console.error('Erro ao eliminar utilizador:', error);
    throw error;
  }
};

// Função para criar utilizadores iniciais (executar uma vez)
export const seedInitialUsers = async (): Promise<void> => {
  try {
    const existingUsers = await getDocs(collection(mainDb, 'users'));
    
    // Só criar se não existirem utilizadores
    if (existingUsers.empty) {
      const initialUsers = [
        {
          username: 'admin',
          password: await bcrypt.hash('guiareal123', 10),
          role: 'user' as const,
          active: true,
          description: 'Conta do Portugal dos Pequenitos',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          username: 'superadmin',
          password: await bcrypt.hash('superadmin123', 10),
          role: 'admin' as const,
          active: true,
          description: 'Conta de Super Administrador',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ];
      
      for (const user of initialUsers) {
        await addDoc(collection(mainDb, 'users'), user);
      }
      
      
    }
  } catch (error) {
    console.error('Erro ao criar utilizadores iniciais:', error);
    throw error;
  }
};