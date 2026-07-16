import type { ReactNode } from 'react'
import {
  LoginForm,
  SignupForm,
  VerifyEmailForm,
  ForgotPasswordForm,
  ResetPasswordForm,
} from 'wasp/client/auth'
import { Link } from 'wasp/client/router'
import './auth.css'

import type { CustomizationOptions } from 'wasp/client/auth'
import { Panel, Brand, serif } from '../root-components/panel'

export const authAppearance: CustomizationOptions['appearance'] = {
  colors: {
    brand: '#3ddc84',
    brandAccent: '#9fe870',
    submitButtonText: '#06160d',
  },
}

export function Layout({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <Panel className='animate-in fade-in mx-auto w-full max-w-md py-12'>
      <Brand />
      <h1
        style={{
          fontFamily: serif,
          fontWeight: 400,
          fontSize: 34,
          color: '#f3f8f4',
          margin: '20px 0 24px',
        }}
      >
        {title}
      </h1>
      {children}
    </Panel>
  )
}

export function Login() {
  return (
    <Layout title='Sign in'>
      <div className='login'>
        <LoginForm appearance={authAppearance} />
      </div>
      <p className='login-text'>
        No account yet? <Link to='/signup'>create one →</Link>
      </p>
      <p className='login-text'>
        Forgot your password? <Link to='/request-password-reset'>reset it</Link>
      </p>
    </Layout>
  )
}

export function Signup() {
  return (
    <Layout title='Create account'>
      <div className='login'>
        <SignupForm appearance={authAppearance} />
      </div>
      <p className='login-text'>
        Already have an account? <Link to='/login'>sign in</Link>
      </p>
    </Layout>
  )
}

export function EmailVerification() {
  return (
    <Layout title='Verify email'>
      <div className='login'>
        <VerifyEmailForm appearance={authAppearance} />
      </div>
      <p className='login-text'>
        All set? <Link to='/login'>sign in</Link>
      </p>
    </Layout>
  )
}

export function RequestPasswordReset() {
  return (
    <Layout title='Reset password'>
      <div className='login'>
        <ForgotPasswordForm appearance={authAppearance} />
      </div>
    </Layout>
  )
}

export function PasswordReset() {
  return (
    <Layout title='Set new password'>
      <div className='login'>
        <ResetPasswordForm appearance={authAppearance} />
      </div>
      <p className='login-text'>
        Done? <Link to='/login'>sign in</Link>
      </p>
    </Layout>
  )
}
