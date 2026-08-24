// ============================================================
// CONFIGURATION
// ============================================================
const STRIPE_PAYMENT_LINK = 'https://buy.stripe.com/eVqdR9gqCcfCduw0lXgw001';
const STRIPE_PORTAL_LINK = 'https://billing.stripe.com/p/login/28E3cvb6i4NaaikecNgw000';
// Paste the SAME Google Apps Script Web App URL you put in lounge.html (ends in /exec).
const SIGNUP_ENDPOINT = 'https://script.google.com/macros/s/AKfycbxDlGG2mlN_fT3I6B81LVIXL3MaSUsGZqf9eubgDhYO-RQsp7_f5fpVUEytGkySaZ4/exec';
// Webinar (€9, "50 spots" is scarcity copy only — nothing in this codebase
// counts or caps signups against that number, by design. Do NOT enable
// Stripe's "Limit the number of payments" on this Payment Link, or it
// becomes a real cap and contradicts the intent. Paste the Payment Link
// once created; set its success URL in Stripe to:
// https://YOUR-DOMAIN.com/?webinar=success
const WEBINAR_LINK = '';
// ============================================================

// Fire-and-forget: send an applicant to the Google Sheet. Never blocks the
// redirect to Stripe; keepalive lets it finish even as the page navigates away.
function reportSignup(payload) {
    if (!SIGNUP_ENDPOINT) return;
    try {
        new Image().src = SIGNUP_ENDPOINT + '?data=' + encodeURIComponent(JSON.stringify(payload));
    } catch (e) {}
}

// === Terms toggle ===
document.getElementById('toggleTerms').addEventListener('click', function () {
    const box = document.getElementById('termsBox');
    box.classList.toggle('open');
    this.textContent = box.classList.contains('open')
        ? 'Hide Terms & Conditions ↑'
        : 'Read Terms & Conditions ↓';
});

// === Both checkboxes must be checked to enable button ===
const acceptTerms = document.getElementById('acceptTerms');
const acceptEligibility = document.getElementById('acceptEligibility');

function updatePayBtn() {
    document.getElementById('payBtn').disabled = !(acceptTerms.checked && acceptEligibility.checked);
}

acceptTerms.addEventListener('change', updatePayBtn);
acceptEligibility.addEventListener('change', updatePayBtn);

// === Form submission → redirect to Stripe ===
document.getElementById('enrollForm').addEventListener('submit', function (e) {
    e.preventDefault();

    if (!acceptTerms.checked || !acceptEligibility.checked) return;

    const TERMS_VERSION = '2026.03.31';
    const timestamp = new Date().toISOString();

    const data = {
        name: document.getElementById('fullName').value.trim(),
        email: document.getElementById('email').value.trim(),
        whatsapp: document.getElementById('whatsapp').value.trim(),
        consents: {
            terms_accepted: true,
            eligibility_confirmed: true,
            terms_version: TERMS_VERSION
        },
        timestamp: timestamp,
        user_agent: navigator.userAgent,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        locale: navigator.language
    };

    // Attempt to log IP via public API (best-effort, non-blocking)
    fetch('https://api.ipify.org?format=json')
        .then(r => r.json())
        .then(ip => { data.ip = ip.ip; })
        .catch(() => { data.ip = 'unavailable'; })
        .finally(() => {
            // Store submission log (append to array for multiple submissions)
            const log = JSON.parse(localStorage.getItem('imat_submissions') || '[]');
            log.push(data);
            localStorage.setItem('imat_submissions', JSON.stringify(log));
            localStorage.setItem('imat_subscriber', JSON.stringify(data));

            // Send the applicant to the Google Sheet before redirecting to Stripe
            reportSignup({
                source: 'application',
                email: data.email,
                name: data.name,
                whatsapp: data.whatsapp,
                user_agent: data.user_agent
            });

            const paymentUrl = STRIPE_PAYMENT_LINK +
                (STRIPE_PAYMENT_LINK.includes('?') ? '&' : '?') +
                'prefilled_email=' + encodeURIComponent(data.email);

            window.location.href = paymentUrl;
        });
});

// === Check for successful payment return ===
if (window.location.search.includes('payment=success')) {
    const step1 = document.getElementById('step1');
    const stepSuccess = document.getElementById('stepSuccess');
    if (step1) step1.classList.remove('active');
    if (stepSuccess) stepSuccess.classList.add('active');

    const manageLink = document.getElementById('manageLink');
    if (manageLink) manageLink.href = STRIPE_PORTAL_LINK;

    setTimeout(() => {
        document.getElementById('enroll').scrollIntoView({ behavior: 'smooth' });
    }, 300);

    window.history.replaceState({}, '', window.location.pathname);
}

// === Match Quiz ===
(function() {
    const questions = document.querySelectorAll('.quiz-q');
    const progressBar = document.getElementById('quizProgressBar');
    const counter = document.getElementById('quizCounter');
    const resultBox = document.getElementById('quizResult');
    const quizBox = document.getElementById('quizBox');
    const enrollBox = document.getElementById('enrollBox');
    const total = questions.length;
    let current = 0;
    let scores = [];

    if (!questions.length) return;

    document.querySelectorAll('.quiz-opt').forEach(btn => {
        btn.addEventListener('click', function() {
            const score = parseInt(this.dataset.score);
            scores[current] = score;

            // Visual feedback
            this.parentElement.querySelectorAll('.quiz-opt').forEach(b => b.classList.remove('selected'));
            this.classList.add('selected');

            // Short delay then advance
            setTimeout(() => {
                current++;
                if (current < total) {
                    // Show next question
                    questions.forEach(q => q.classList.remove('active'));
                    questions[current].classList.add('active');
                    progressBar.style.width = ((current / total) * 100) + '%';
                    counter.textContent = 'Screening — ' + (current + 1) + ' of ' + total;
                } else {
                    // Show result
                    showResult();
                }
            }, 400);
        });
    });

    function showResult() {
        const maxScore = total * 3;
        const totalScore = scores.reduce((a, b) => a + b, 0);
        const pct = Math.round((totalScore / maxScore) * 100);

        progressBar.style.width = '100%';
        counter.style.display = 'none';
        document.getElementById('quizQuestions').style.display = 'none';
        resultBox.style.display = 'block';

        // Determine color and message
        let color, title, text;
        if (pct >= 72) {
            color = 'green';
            title = 'Rom & Maya would take you on.';
            text = 'You\'re the type of candidate they look for — independent, hungry, and ready to be directed. They don\'t work with many. If a spot is open, this is your chance to claim it.';
        } else if (pct >= 45) {
            color = 'orange';
            title = 'Rom & Maya might consider you.';
            text = 'You have potential, but they only invest time in candidates who are ready to show up and execute. If you\'re willing to commit and shift your approach, apply — they\'ll review your profile.';
        } else {
            color = 'red';
            title = 'Not what Rom & Maya are looking for — yet.';
            text = 'They work with self-driven candidates who need direction, not full lessons. This isn\'t a course. But if something changes and you\'re ready to work differently — the application stays open.';
        }

        // Animate score ring
        const ringFill = document.getElementById('quizRingFill');
        const circumference = 326.73;
        const offset = circumference - (pct / 100) * circumference;
        ringFill.classList.add(color);

        setTimeout(() => {
            ringFill.style.strokeDashoffset = offset;
        }, 100);

        // Animate score number
        const scoreNum = document.getElementById('quizScoreNumber');
        let count = 0;
        const interval = setInterval(() => {
            count += 2;
            if (count >= pct) {
                count = pct;
                clearInterval(interval);
            }
            scoreNum.textContent = count + '%';
        }, 20);

        const titleEl = document.getElementById('quizResultTitle');
        titleEl.textContent = title;
        titleEl.classList.add(color);
        document.getElementById('quizResultText').textContent = text;

        // Continue button reveals enrollment form
        document.getElementById('quizContinueBtn').addEventListener('click', function() {
            quizBox.style.display = 'none';
            enrollBox.style.display = 'block';
            enrollBox.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    }
})();

// === Smooth scroll ===
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) target.scrollIntoView({ behavior: 'smooth' });
    });
});

// === Scroll animations ===
const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('visible');
        }
    });
}, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

document.querySelectorAll('.stat, .compare-card, .include-item, .cred, .about-letter').forEach(el => {
    el.classList.add('fade-in');
    observer.observe(el);
});

// === Webinar popup ===
(function() {
    const overlay = document.getElementById('webinarOverlay');
    if (!overlay) return;

    const closeBtn = document.getElementById('webinarClose');
    const buyBtn = document.getElementById('webinarBuyBtn');
    const offerBox = document.getElementById('webinarOffer');
    const successBox = document.getElementById('webinarSuccess');

    const REGISTERED_KEY = 'imat_webinar_registered';
    const alreadyRegistered = localStorage.getItem(REGISTERED_KEY) === 'true';

    function showOverlay() {
        overlay.classList.add('show');
    }
    function hideOverlay() {
        overlay.classList.remove('show');
    }

    closeBtn.addEventListener('click', hideOverlay);
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) hideOverlay();
    });

    buyBtn.addEventListener('click', () => {
        if (WEBINAR_LINK) {
            window.location.href = WEBINAR_LINK;
        } else {
            alert('Webinar payment link is being set up — check back shortly.');
        }
    });

    // Returning from Stripe after webinar payment. The Zoom link itself is
    // deliberately NOT shown here — a link baked into ?webinar=success would
    // work for anyone who lands on that URL, paid or not (and this URL is
    // guessable/shareable). Instead this points them to WhatsApp, where you
    // send the real link personally after confirming their payment in Stripe.
    if (window.location.search.includes('webinar=success')) {
        localStorage.setItem(REGISTERED_KEY, 'true');
        offerBox.classList.add('hidden');
        successBox.classList.remove('hidden');
        showOverlay();
        window.history.replaceState({}, '', window.location.pathname);
        return; // don't start the recurring popup for someone who just registered
    }

    // Someone who registered on a previous visit — never show the offer again
    if (alreadyRegistered) return;

    // Someone who just finished the €79/mo checkout — let them see their
    // confirmation and WhatsApp link cleanly, don't cover it with a popup
    if (window.location.search.includes('payment=success')) return;

    // Show immediately on page load, then every 30s while they stay on the page
    showOverlay();
    setInterval(showOverlay, 30000);
})();
