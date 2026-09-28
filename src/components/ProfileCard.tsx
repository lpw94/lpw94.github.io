import type { ReactNode } from 'react'
import { profile, type ProfileLink } from '../profile'

/** 社交图标（内联 SVG，currentColor 跟随主题色） */
const ICONS: Record<NonNullable<ProfileLink['icon']>, ReactNode> = {
  mail: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m22 7-10 6L2 7" />
    </svg>
  ),
  github: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
    </svg>
  ),
  weibo: (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <g transform="rotate(-12 12 13)">
        <ellipse cx="11.5" cy="13.5" rx="8" ry="5.8" />
        <circle cx="10.5" cy="13.5" r="2.6" fill="currentColor" stroke="none" />
        <circle cx="9.8" cy="12.8" r="0.7" fill="#fff" stroke="none" />
      </g>
      <path d="M15.5 6.2c2.6-.9 5 .5 5.4 2.8" strokeLinecap="round" />
      <path d="M16.8 8.6c1.5-.4 2.9.4 3.1 1.8" strokeLinecap="round" />
    </svg>
  ),
  x: (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
      <path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z" />
    </svg>
  ),
}

export default function ProfileCard() {
  const social = profile.links.filter((l) => l.icon)
  const textLinks = profile.links.filter((l) => !l.icon)

  return (
    <aside className="profile-card">
      <img className="profile-avatar" src={profile.avatar} alt={profile.name} />
      <h2 className="profile-name">{profile.name}</h2>
      <p className="profile-bio">{profile.bio}</p>

      {/* 社交图标行（邮箱 / GitHub / 微博 / X） */}
      {social.length > 0 && (
        <ul className="profile-social">
          {social.map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                title={link.label}
                aria-label={link.label}
                {...(link.href.startsWith('http')
                  ? { target: '_blank', rel: 'noreferrer' }
                  : {})}
              >
                {ICONS[link.icon!]}
              </a>
            </li>
          ))}
        </ul>
      )}

      <ul className="profile-links">
        {textLinks.map((link) => (
          <li key={link.href}>
            <span className="profile-link-label">{link.label}</span>
            <a
              href={link.href}
              {...(link.href.startsWith('http')
                ? { target: '_blank', rel: 'noreferrer' }
                : {})}
            >
              {link.text ?? link.href}
            </a>
          </li>
        ))}
      </ul>
    </aside>
  )
}
