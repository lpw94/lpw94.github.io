import { profile } from '../profile'

export default function ProfileCard() {
  return (
    <aside className="profile-card">
      <img className="profile-avatar" src={profile.avatar} alt={profile.name} />
      <h2 className="profile-name">{profile.name}</h2>
      <p className="profile-bio">{profile.bio}</p>
      <ul className="profile-links">
        {profile.links.map((link) => (
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
