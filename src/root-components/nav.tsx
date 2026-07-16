import { forwardRef, type HTMLAttributes } from 'react'
import { useLocation } from 'react-router'
import { Link } from 'wasp/client/router'
import { logout } from 'wasp/client/auth'
import { type User } from 'wasp/entities'
import { cn, usePrefetch } from '../lib/utils'

const mono = "'IBM Plex Mono', ui-monospace, monospace"

interface NavProps extends HTMLAttributes<HTMLElement> {
  user?: User | null
  userLoading?: boolean
}

const linkCls =
  'text-[11px] tracking-[1.5px] text-[#5f7a6c] hover:text-[#e8efe9] transition-colors'

const Nav = forwardRef<HTMLElement, NavProps>(
  ({ user, userLoading, ...props }, ref) => {
    const location = useLocation()
    const prefetch = usePrefetch()

    return (
      <nav
        ref={ref}
        style={{ fontFamily: mono }}
        className={cn(
          'mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-4 lg:px-8',
          props.className,
        )}
        {...props}
      >
        <Link
          to='/'
          className='flex items-center gap-2.5 no-underline'
          onMouseEnter={() => prefetch('/', undefined, { assets: true })}
        >
          <span
            style={{
              width: 9,
              height: 9,
              borderRadius: 999,
              background: '#3ddc84',
              boxShadow: '0 0 8px rgba(61,220,132,.7)',
            }}
          />
          <span className='text-[12px] tracking-[2px] text-[#e8efe9]'>
            GRID CARBON CLOCK
          </span>
        </Link>

        <div className='flex items-center gap-5'>
          {userLoading ? null : user ? (
            <>
              <Link
                to='/profile'
                className={cn(
                  linkCls,
                  location.pathname === '/profile' && 'text-[#e8efe9]',
                )}
                onMouseEnter={() => prefetch('/profile', { id: user.id })}
              >
                PROFILE
              </Link>
              <button
                onClick={() => logout()}
                style={{
                  fontFamily: mono,
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 0,
                }}
                className={linkCls}
              >
                LOG OUT
              </button>
            </>
          ) : (
            <>
              <Link
                to='/login'
                className={linkCls}
                onMouseEnter={() =>
                  prefetch('/login', undefined, { assets: true })
                }
              >
                SIGN IN
              </Link>
              <Link
                to='/signup'
                className='text-[11px] tracking-[1.5px] text-[#3ddc84] transition-colors hover:text-[#9fe870]'
                onMouseEnter={() =>
                  prefetch('/signup', undefined, { assets: true })
                }
              >
                SIGN UP →
              </Link>
            </>
          )}
        </div>
      </nav>
    )
  },
)

Nav.displayName = 'Nav'

export { Nav }
