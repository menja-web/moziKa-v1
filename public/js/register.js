console.log("register.js chargé ✅");

async function registerUser(username, email, password) {
  const msg = document.getElementById("registerMessage");

  try {
    const response = await fetch("/api/register", {
      method: "POST",
      credentials: "include",  // ✅ Essentiel pour que le backend envoie le cookie de session
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ username, email, password })
    });

    const result = await response.json();
    console.log("Réponse inscription :", result);

    if (result.status === "success") {
      // ✅ Enregistrement dans le stockage local
      localStorage.setItem("mozika_username", username);
      localStorage.setItem("userEmail", email);

      // ✅ Message de succès
      msg.style.color = "green";
      msg.textContent = "✅ Compte créé avec succès ! Redirection...";

      // ✅ Redirection vers accueil
      setTimeout(() => {
        window.location.href = "accueil.html";
      }, 1500);
    } else {
      msg.style.color = "red";
      msg.textContent = result.message || "Erreur lors de la création du compte.";
    }
  } catch (err) {
    console.error("Erreur fetch :", err);
    msg.style.color = "red";
    msg.textContent = "❌ Erreur serveur, réessaie plus tard.";
  }
}

document.getElementById("registerForm").addEventListener("submit", function(e) {
  e.preventDefault();

  const username = document.getElementById("username").value.trim();
  const email    = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();

  const msg = document.getElementById("registerMessage");

  if (!username || !email || !password) {
    msg.style.color = "red";
    msg.textContent = "❌ Tous les champs sont obligatoires.";
    return;
  }

  registerUser(username, email, password);
});
