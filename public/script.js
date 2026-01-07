// 1. PRELOADER LOGIC
window.addEventListener("load", () => {
  const logo = document.getElementById("loaderLogo");
  logo.style.opacity = "1";
  logo.style.transform = "scale(1)";

  setTimeout(() => {
    document.getElementById("loader").style.transform = "translateY(-100%)";
  }, 1800);
});

// 2. SMOOTH SCROLL
const lenis = new Lenis();
function raf(time) {
  lenis.raf(time);
  requestAnimationFrame(raf);
}
requestAnimationFrame(raf);

// 3. MAGNETICS
const magnets = document.querySelectorAll(".magnetic");
magnets.forEach((m) => {
  m.addEventListener("mousemove", function (e) {
    const rect = this.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    this.style.transform = `translate(${x * 0.3}px, ${y * 0.3}px)`;
  });
  m.addEventListener("mouseleave", function () {
    this.style.transform = `translate(0px, 0px)`;
  });
});

// 5. REVEAL
const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) entry.target.classList.add("active");
    });
  },
  { threshold: 0.1 }
);
document.querySelectorAll(".reveal").forEach((el) => observer.observe(el));

// 6. MOBILE MENU TOGGLE
const burgerBtn = document.getElementById("burgerBtn");
const mobileMenu = document.getElementById("mobileMenu");
const mobileLinks = document.querySelectorAll(".mobile-menu-link");

burgerBtn?.addEventListener("click", () => {
  burgerBtn.classList.toggle("active");
  mobileMenu.classList.toggle("active");
  document.body.style.overflow = mobileMenu.classList.contains("active") ? "hidden" : "";
});

mobileLinks.forEach((link) => {
  link.addEventListener("click", () => {
    burgerBtn.classList.remove("active");
    mobileMenu.classList.remove("active");
    document.body.style.overflow = "";
  });
});

// 7. CONTACT FORM SUBMISSION
const contactForm = document.querySelector(".contact-form");
contactForm?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const email = document.getElementById("email");
  const message = document.getElementById("message");
  const submitBtn = contactForm.querySelector('button[type="submit"]');
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  // Clear previous errors/messages
  clearErrors();
  clearFormMessage();

  let isValid = true;

  // Email validation
  if (!emailRegex.test(email.value.trim())) {
    showError(email, "Please enter a valid email address");
    isValid = false;
  }

  // Message validation
  if (message.value.trim() === "") {
    showError(message, "Please enter a message");
    isValid = false;
  }

  if (!isValid) return;

  // Submit form via fetch
  submitBtn.disabled = true;
  submitBtn.textContent = "Sending...";

  try {
    const response = await fetch(contactForm.action, {
      method: "POST",
      body: new FormData(contactForm),
    });

    if (response.ok) {
      showFormMessage("Message sent successfully!", "success");
      contactForm.reset();
    } else {
      const errorText = await response.text();
      showFormMessage(errorText || "Failed to send message. Please try again.", "error");
    }
  } catch (error) {
    showFormMessage("An error occurred. Please try again.", "error");
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Send Inquiry";
  }
});

function showError(input, message) {
  input.classList.add("input-error");
  const error = document.createElement("span");
  error.className = "error-message";
  error.textContent = message;
  input.parentElement.appendChild(error);
}

function clearErrors() {
  document.querySelectorAll(".error-message").forEach((el) => el.remove());
  document.querySelectorAll(".input-error").forEach((el) => el.classList.remove("input-error"));
}

function showFormMessage(text, type) {
  const msg = document.createElement("div");
  msg.className = `form-message form-message--${type}`;
  msg.textContent = text;
  contactForm.appendChild(msg);
}

function clearFormMessage() {
  document.querySelectorAll(".form-message").forEach((el) => el.remove());
}
