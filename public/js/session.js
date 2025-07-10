// session.js
document.addEventListener('DOMContentLoaded', async () => {
  try {
    const res = await fetch('/api/get-session', {
      method: 'GET',
      credentials: 'include'
    });
    const data = await res.json();
    if (data.status === 'success') {
      // ex. Afficher le nom de l'utilisateur
      document.getElementById('user-name').textContent = data.user.username;
      // autoriser accès profil, upload, etc.
    } else {
      // pas connecté → masquer le bouton profil
      document.getElementById('profile-link').style.display = 'none';
    }
  } catch (err) {
    console.error('Erreur session :', err);
  }
});
