import { createContext, useContext, useEffect, useState } from 'react'
import api from '../api/client'

const UserContext = createContext(null)

const DEFAULT_NAME = '读者'

function generateUserId() {
  return 'user-' + Math.random().toString(36).slice(2, 10)
}

export function UserProvider({ children }) {
  const [userId] = useState(() => sessionStorage.getItem('userId') || generateUserId())
  const [user, setUser] = useState(null)

  useEffect(() => {
    sessionStorage.setItem('userId', userId)
    // Ensure user exists in backend
    api.post('/users', { user_id: userId, name: DEFAULT_NAME })
      .catch(() => {}) // ignore 409 if already exists
    api.get(`/users/${userId}`)
      .then(r => setUser(r.data))
      .catch(() => {})
  }, [userId])

  return (
    <UserContext.Provider value={{ userId, user, setUser }}>
      {children}
    </UserContext.Provider>
  )
}

export function useUser() {
  return useContext(UserContext)
}
