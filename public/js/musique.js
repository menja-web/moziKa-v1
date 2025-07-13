document.addEventListener("DOMContentLoaded", () => {
  const musicCards = document.querySelectorAll(".music-card");

  musicCards.forEach((card) => {
    const musicId = card.dataset.id;

    const favBtn = document.createElement("button");
    favBtn.textContent = "💙 Ajouter aux favoris";
    favBtn.className = "favBtn";

    favBtn.addEventListener("click", () => {
      fetch(`${baseUrl}/api/favorites/add`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ musicId })
      })
      .then(res => res.json())
      .then(data => {
        if (data.status === "success") {
          alert("Ajouté aux favoris 💙");
        } else {
          alert("Erreur : " + data.message);
        }
      })
      .catch(err => {
        console.error("Erreur ajout favoris :", err);
      });
    });

    card.appendChild(favBtn);
  });
});
