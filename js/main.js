(function () {
  "use strict";

  var header = document.getElementById("header");
  var navbar = document.getElementById("navbar");
  var toggle = document.querySelector(".mobile-nav-toggle");
  var nextElement = header ? header.nextElementSibling : null;
  var backToTop = document.querySelector(".back-to-top");

  function headerFixed() {
    if (!header) return;
    if (window.scrollY > 24) {
      header.classList.add("fixed-top");
      if (nextElement) nextElement.classList.add("scrolled-offset");
    } else {
      header.classList.remove("fixed-top");
      if (nextElement) nextElement.classList.remove("scrolled-offset");
    }
  }

  function toggleBackToTop() {
    if (!backToTop) return;
    backToTop.classList.toggle("active", window.scrollY > 100);
  }

  function closeMobileNav() {
    if (!navbar || !navbar.classList.contains("navbar-mobile")) return;
    navbar.classList.remove("navbar-mobile");
    if (toggle) {
      toggle.classList.add("bi-list");
      toggle.classList.remove("bi-x");
      toggle.setAttribute("aria-label", "Open menu");
      toggle.setAttribute("aria-expanded", "false");
    }
  }

  window.addEventListener("scroll", function () {
    headerFixed();
    toggleBackToTop();
  }, { passive: true });
  headerFixed();
  toggleBackToTop();

  if (toggle && navbar) {
    toggle.addEventListener("click", function () {
      var open = navbar.classList.toggle("navbar-mobile");
      toggle.classList.toggle("bi-list", !open);
      toggle.classList.toggle("bi-x", open);
      toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
  }

  document.querySelectorAll("#navbar .dropdown > a").forEach(function (link) {
    link.addEventListener("click", function (e) {
      if (navbar && navbar.classList.contains("navbar-mobile")) {
        e.preventDefault();
        var menu = link.nextElementSibling;
        if (menu) menu.classList.toggle("dropdown-active");
      } else if (link.getAttribute("href") === "#") {
        e.preventDefault();
      }
    });
  });

  function scrollToHash(hash) {
    var target = document.querySelector(hash);
    if (!target) return;
    var offset = header ? header.offsetHeight : 0;
    var top = target.getBoundingClientRect().top + window.scrollY - offset;
    window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
  }

  document.querySelectorAll(".scrollto").forEach(function (link) {
    link.addEventListener("click", function (e) {
      if (!link.hash || !document.querySelector(link.hash)) return;
      e.preventDefault();
      closeMobileNav();
      scrollToHash(link.hash);
    });
  });

  if (backToTop) {
    backToTop.addEventListener("click", function (e) {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  if (window.location.hash && document.querySelector(window.location.hash)) {
    window.addEventListener("load", function () {
      scrollToHash(window.location.hash);
    });
  }

  var galleryRoot = document.querySelector(".si-gallery");
  if (galleryRoot && typeof Swiper !== "undefined") {
    var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var gallery = new Swiper(galleryRoot, {
      loop: true,
      speed: reduce ? 0 : 650,
      spaceBetween: 0,
      autoplay: reduce ? false : {
        delay: 4800,
        disableOnInteraction: false
      },
      pagination: {
        el: galleryRoot.querySelector(".si-gallery__pagination"),
        clickable: true
      },
      navigation: {
        nextEl: galleryRoot.querySelector(".si-gallery__next"),
        prevEl: galleryRoot.querySelector(".si-gallery__prev")
      },
      keyboard: {
        enabled: true,
        onlyInViewport: true
      },
      a11y: {
        prevSlideMessage: "Previous photo",
        nextSlideMessage: "Next photo"
      }
    });
    galleryRoot.addEventListener("mouseenter", function () {
      if (gallery.autoplay) gallery.autoplay.stop();
    });
    galleryRoot.addEventListener("mouseleave", function () {
      if (gallery.autoplay && !reduce) gallery.autoplay.start();
    });
  }

  var form = document.getElementById("contact-form1");
  if (!form) return;

  var LEAD_API_URL = "https://siliconiatech.webwideit.solutions/siliconiatech/public/api/v1/lead/store";
  var FETCH_TIMEOUT_MS = 15000;
  var errorMsg = document.getElementById("err-msg");
  var successMsg = document.getElementById("success-msg");
  var submitBtn = document.getElementById("cc-submit-btn");
  var submitText = document.getElementById("cc-submit-text");
  var submitSpinner = document.getElementById("cc-submit-spinner");
  var isSubmitting = false;
  var FIELDS = ["name", "phone", "email", "company", "city", "notes"];

  form.addEventListener("submit", handleSubmit);

  FIELDS.forEach(function (field) {
    var input = document.getElementById("cc-" + field);
    if (input) {
      input.addEventListener("input", function () {
        clearFieldError(field);
      });
    }
  });

  document.getElementById("cc-phone").addEventListener("input", function (e) {
    e.target.value = e.target.value.replace(/\D/g, "").slice(0, 10);
  });

  async function handleSubmit(e) {
    e.preventDefault();
    if (isSubmitting) return;

    hideBanners();
    if (form.hidden_field.value) return;
    if (!validateForm()) return;

    var payload = {
      name: form.name.value.trim(),
      phone: form.phone.value.trim(),
      email: form.email.value.trim(),
      company: form.company.value.trim(),
      city: form.city.value.trim(),
      notes: form.notes.value.trim()
    };

    showLoading();

    try {
      var response = await fetchWithTimeout(LEAD_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json"
        },
        body: JSON.stringify(payload)
      });

      if (response.status === 201) {
        hideLoading();
        successMsg.style.display = "block";
        form.reset();
        return;
      }

      if (response.status === 422) {
        var invalid = await response.json();
        hideLoading();
        applyBackendValidationErrors(invalid.errors);
        return;
      }

      if (response.status >= 500) {
        var server = await response.json().catch(function () { return null; });
        hideLoading();
        showBannerError((server && server.message) || "Something went wrong. Please try again later.");
        return;
      }

      var other = await response.json().catch(function () { return null; });
      hideLoading();
      showBannerError((other && other.message) || "Submission failed. Please try again.");
    } catch (err) {
      hideLoading();
      if (err && err.message === "timeout") {
        showBannerError("The request timed out. Please check your connection and try again.");
      } else {
        showBannerError("Network error. Please check your connection and try again.");
      }
    }
  }

  function validateForm() {
    var isValid = true;
    clearAllErrors();

    var name = form.name.value.trim();
    var phone = form.phone.value.trim();
    var email = form.email.value.trim();
    var company = form.company.value.trim();
    var city = form.city.value.trim();

    if (!name) {
      showFieldError("name", "Full name is required.");
      isValid = false;
    } else if (name.length > 255) {
      showFieldError("name", "Name must be under 255 characters.");
      isValid = false;
    }

    if (!phone) {
      showFieldError("phone", "Mobile number is required.");
      isValid = false;
    } else if (!/^[6-9]\d{9}$/.test(phone)) {
      showFieldError("phone", "Enter a valid 10-digit mobile number starting with 6, 7, 8 or 9.");
      isValid = false;
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showFieldError("email", "Enter a valid email address.");
      isValid = false;
    }

    if (company && (!/[A-Za-z]/.test(company) || !/^[A-Za-z0-9\s.\-&',()]*$/.test(company))) {
      showFieldError("company", "Company name looks invalid — please check it.");
      isValid = false;
    }

    if (city && !/^[A-Za-z\s.-]*$/.test(city)) {
      showFieldError("city", "City should only contain letters, spaces, hyphens or dots.");
      isValid = false;
    }

    if (!isValid) {
      var firstInvalid = form.querySelector(".cc-invalid");
      if (firstInvalid) firstInvalid.scrollIntoView({ behavior: "smooth", block: "center" });
    }

    return isValid;
  }

  function applyBackendValidationErrors(errors) {
    if (!errors) {
      showBannerError("Please check the form and try again.");
      return;
    }

    Object.keys(errors).forEach(function (field) {
      var message = Array.isArray(errors[field]) ? errors[field][0] : String(errors[field]);
      showFieldError(field, message);
    });

    var firstInvalid = form.querySelector(".cc-invalid");
    if (firstInvalid) firstInvalid.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function showFieldError(field, message) {
    var input = document.getElementById("cc-" + field);
    var errorEl = document.getElementById("cc-err-" + field);
    if (input) input.classList.add("cc-invalid");
    if (errorEl) errorEl.textContent = message;
  }

  function clearFieldError(field) {
    var input = document.getElementById("cc-" + field);
    var errorEl = document.getElementById("cc-err-" + field);
    if (input) input.classList.remove("cc-invalid");
    if (errorEl) errorEl.textContent = "";
  }

  function clearAllErrors() {
    FIELDS.forEach(clearFieldError);
  }

  function showLoading() {
    isSubmitting = true;
    submitBtn.disabled = true;
    submitText.textContent = "Submitting...";
    submitSpinner.style.display = "inline-block";
  }

  function hideLoading() {
    isSubmitting = false;
    submitBtn.disabled = false;
    submitText.textContent = "Submit Inquiry";
    submitSpinner.style.display = "none";
  }

  function showBannerError(message) {
    errorMsg.textContent = message;
    errorMsg.style.display = "block";
  }

  function hideBanners() {
    errorMsg.style.display = "none";
    successMsg.style.display = "none";
  }

  function fetchWithTimeout(url, options) {
    return new Promise(function (resolve, reject) {
      var controller = new AbortController();
      var timer = setTimeout(function () {
        controller.abort();
        reject(new Error("timeout"));
      }, FETCH_TIMEOUT_MS);

      fetch(url, Object.assign({}, options, { signal: controller.signal }))
        .then(function (res) {
          clearTimeout(timer);
          resolve(res);
        })
        .catch(function (err) {
          clearTimeout(timer);
          reject(err);
        });
    });
  }
})();
