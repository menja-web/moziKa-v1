// public/script.js

async function loadMusics() {
  const musicZone = document.getElementById('music-zone');
  musicZone.innerHTML = '<h3>🎧 Tes musiques</h3>';

  try {
    const response = await fetch('/musics');
    const data = await response.json();

    if (data.status === 'success' && data.musics.length > 0) {
      // Vider le message "Aucune musique trouvée" si il y en a
      musicZone.innerHTML = '<h3>🎧 Tes musiques</h3>';

      data.musics.forEach(music => {
        const div = document.createElement('div');
        div.classList.add('music-item');

        const title = document.createElement('h4');
        title.textContent = music.title;
        div.appendChild(title);

        const audio = document.createElement('audio');
        audio.controls = true;
        audio.src = music.path;
        div.appendChild(audio);

        musicZone.appendChild(div);
      });
    } else {
      musicZone.innerHTML += '<p>Aucune musique trouvée pour l’instant.</p>';
    }
  } catch (error) {
    musicZone.innerHTML += `<p>Erreur lors du chargement des musiques : ${error.message}</p>`;
  }
}

window.addEventListener('load', loadMusics);
