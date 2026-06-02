import { type AuthUser } from 'wasp/auth'
import { useState, useEffect } from 'react'
import { Panel, Brand, serif, mono } from './root-components/panel'

const getGreeting = () => {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        flexWrap: 'wrap',
        gap: 8,
        padding: '14px 0',
        borderTop: '1px solid rgba(255,255,255,.07)',
      }}
    >
      <span style={{ fontSize: 11, letterSpacing: 1.5, color: '#5f7a6c', flexBasis: '100%' }}>
        {label}
      </span>
      <span style={{ fontSize: 14, color: '#e8efe9', minWidth: 0, flex: 1, wordBreak: 'break-word' }}>{value}</span>
    </div>
  )
}

const Profile = ({ user }: { user: AuthUser }) => {
  const [greeting, setGreeting] = useState('')

  useEffect(() => {
    setGreeting(getGreeting())
  }, [])

  const notifyBelow = (user as { notifyBelow?: number | null })?.notifyBelow

  return (
    <Panel className='mx-auto w-full max-w-2xl py-12'>
      <Brand />
      <h1
        style={{
          fontFamily: serif,
          fontWeight: 400,
          fontSize: 40,
          color: '#f3f8f4',
          margin: '20px 0 6px',
        }}
      >
        Profile
      </h1>
      <p
        style={{ fontFamily: mono, fontSize: 13, color: '#7d9788', margin: 0 }}
      >
        {greeting}, {user?.username || 'there'}.
      </p>

      <div style={{ marginTop: 28 }}>
        <Row label='USERNAME' value={user?.username || '—'} />
        <Row label='EMAIL' value={user?.email || '—'} />
        <Row
          label='NOTIFY BELOW'
          value={notifyBelow != null ? `${notifyBelow} gCO₂/kWh` : 'not set'}
        />
      </div>
    </Panel>
  )
}

export default Profile
