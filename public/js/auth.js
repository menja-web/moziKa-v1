console.log("auth.js chargé ✅");

// 🔐 Gestion du formulaire d'inscription
const registerForm = document.getElementById("registerForm");
if (registerForm) {
  console.log("registerForm trouvé ✅");

  registerForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const username = document.getElementById("username").value.trim();
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value.trim();
    const msg = document.getElementById("registerMessage");

    if (!username || !email || !password) {
      msg.style.color = "red";
      msg.textContent = "❌ Tous les champs sont obligatoires.";
      return;
    }

    try {
      const response = await fetch("/api/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ username, email, password })
      });

      const result = await response.json();
      console.log("Réponse inscription :", result);

      if (result.status === "success") {
        localStorage.setItem("mozika_username", username);
        localStorage.setItem("userEmail", email);

        msg.style.color = "green";
        msg.textContent = "✅ Compte créé avec succès ! Redirection...";

        // ✅ Redirection vers accueil.html
        setTimeout(() => {
          window.location.href = "accueil.html";
        }, 1500);
      } else {
        msg.style.color = "red";
        msg.textContent = result.message || "Erreur lors de la création du compte.";
      }

    } catch (error) {
      console.error("Erreur inscription :", error);
      msg.style.color = "red";
      msg.textContent = "❌ Erreur serveur, réessaie plus tard.";
    }
  });
}

// 🔓 Gestion du formulaire de connexion
const loginForm = document.getElementById("loginForm");
if (loginForm) {
  console.log("loginForm trouvé ✅");

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value.trim();
    const msg = document.getElementById("loginMessage");

    if (!email || !password) {
      msg.style.color = "red";
      msg.textContent = "❌ Tous les champs sont obligatoires.";
      return;
    }

    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ email, password })
      });

      const result = await response.json();
      console.log("Réponse connexion :", result);

      if (result.status === "success") {
        localStorage.setItem("mozika_username", result.username || "Utilisateur");
        localStorage.setItem("userEmail", email);

        msg.style.color = "green";
        msg.textContent = "✅ Connexion réussie ! Redirection...";

        // ✅ Redirection vers dashboard.html
        setTimeout(() => {
          window.location.href = "dashboard.html";
        }, 1500);
      } else {
        msg.style.color = "red";
        msg.textContent = result.message || "Identifiants incorrects.";
      }

    } catch (error) {
      console.error("Erreur connexion :", error);
      msg.style.color = "red";
      msg.textContent = "❌ Erreur serveur, réessaie plus tard.";
    }
  });
}
