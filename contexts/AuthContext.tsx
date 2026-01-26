'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

interface UserData {
    uid: string;
    email: string | null;
    displayName: string | null;
    centerName?: string;
    department?: string; // e.g. 의대관, 특목관
    role?: 'super_admin' | 'center_admin' | 'dept_admin' | 'teacher' | 'admin'; // 'admin' is legacy super_admin
}

interface AuthContextType {
    user: User | null;
    userData: UserData | null;
    loading: boolean;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    userData: null,
    loading: true,
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
    const [user, setUser] = useState<User | null>(null);
    const [userData, setUserData] = useState<UserData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            setUser(user);
            if (user) {
                // Fetch user specific data (centerName, role) from Firestore
                try {
                    const userDoc = await getDoc(doc(db, 'teachers', user.uid));
                    let data = userDoc.exists() ? userDoc.data() as UserData : null;

                    // Check Legacy Admin List & Auto-Update
                    const { ALLOWED_ADMINS } = await import('@/lib/admins');
                    const isLegacyAdmin = user.email && ALLOWED_ADMINS.map(e => e.toLowerCase()).includes(user.email.toLowerCase());

                    if (isLegacyAdmin) {
                        if (!data) {
                            // Create doc if missing
                            data = {
                                uid: user.uid,
                                email: user.email,
                                displayName: user.displayName,
                                role: 'admin'
                            };
                            const { setDoc } = await import('firebase/firestore');
                            await setDoc(doc(db, 'teachers', user.uid), data, { merge: true });
                        } else if (data.role !== 'admin') {
                            // Upgrade role if needed
                            data.role = 'admin';
                            const { updateDoc } = await import('firebase/firestore');
                            await updateDoc(doc(db, 'teachers', user.uid), { role: 'admin' });
                        }
                    }

                    if (data) {
                        setUserData({ ...data, uid: user.uid } as UserData);
                    } else {
                        // Fallback
                        setUserData({
                            uid: user.uid,
                            email: user.email,
                            displayName: user.displayName,
                            role: isLegacyAdmin ? 'admin' : 'teacher' // Default
                        });
                    }
                } catch (error) {
                    console.error("Error fetching user data:", error);
                }
            } else {
                setUserData(null);
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    return (
        <AuthContext.Provider value={{ user, userData, loading }}>
            {children}
        </AuthContext.Provider>
    );
};
