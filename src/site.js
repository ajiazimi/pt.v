// 0. CSP-safe Brand Logo Fallback
(function() {
  document.querySelectorAll('.brand-img').forEach(function(img) {
    img.addEventListener('error', function() {
      if (!img.dataset.tried) {
        img.dataset.tried = '1';
        img.src = './assets/logo.webp';
      } else if (img.dataset.tried === '1') {
        img.dataset.tried = '2';
        img.src = './public/assets/logo.png';
      }
    });
  });
})();

// 1. Mobile Slide-In Navigation Drawer with Backdrop & Close Button
(function() {
  var burger = document.getElementById('burgerBtn');
  var menu = document.getElementById('mobileMenu');
  var closeBtn = document.getElementById('mobileMenuClose');
  var backdrop = document.getElementById('mobileMenuBackdrop');
  if (!burger || !menu) return;

  function openMobileMenu() {
    menu.classList.add('open');
    menu.setAttribute('aria-hidden', 'false');
    burger.setAttribute('aria-expanded', 'true');
    if (backdrop) {
      backdrop.classList.add('is-open');
      backdrop.setAttribute('aria-hidden', 'false');
    }
    document.body.style.overflow = 'hidden';
  }

  function closeMobileMenu() {
    menu.classList.remove('open');
    menu.setAttribute('aria-hidden', 'true');
    burger.setAttribute('aria-expanded', 'false');
    if (backdrop) {
      backdrop.classList.remove('is-open');
      backdrop.setAttribute('aria-hidden', 'true');
    }
    document.body.style.overflow = '';
  }

  window.__vvCloseMobileMenu = closeMobileMenu;

  burger.addEventListener('click', function(e) {
    e.stopPropagation();
    if (menu.classList.contains('open')) {
      closeMobileMenu();
    } else {
      openMobileMenu();
    }
  });

  if (closeBtn) {
    closeBtn.addEventListener('click', function(e) {
      e.preventDefault();
      closeMobileMenu();
      burger.focus();
    });
  }

  if (backdrop) {
    backdrop.addEventListener('click', closeMobileMenu);
  }

  menu.addEventListener('click', function(e) {
    if (e.target && e.target.closest('a')) {
      closeMobileMenu();
    }
  });

  document.addEventListener('click', function(e) {
    if (menu.classList.contains('open') && !menu.contains(e.target) && !burger.contains(e.target)) {
      closeMobileMenu();
    }
  });

  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && menu.classList.contains('open')) {
      closeMobileMenu();
      burger.focus();
    }
  });
})();

// 2. Fallback Video Looping (activated only when WebGL is unavailable)
(function() {
  var started = false;
  function startFallbackVideo() {
    if (started) return;
    started = true;

    var vA = document.getElementById('bgVideoA');
    var vB = document.getElementById('bgVideoB');
    if (!vA || !vB) return;

    vA.muted = true;
    vA.defaultMuted = true;
    vB.muted = true;
    vB.defaultMuted = true;
    vA.classList.add('is-active');

    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      vA.pause();
      vB.pause();
      return;
    }

    var FADE = 0.9;
    var cur = vA;
    var nxt = vB;
    var swapping = false;

    function play(v) {
      var p = v.play();
      if (p && typeof p.catch === 'function') {
        p.catch(function() {});
      }
    }

    play(vA);

    function tryUnlockAutoplay() {
      if (vA.paused) play(vA);
    }
    window.addEventListener('pointerdown', tryUnlockAutoplay, { once: true, passive: true });
    window.addEventListener('scroll', tryUnlockAutoplay, { once: true, passive: true });
    window.addEventListener('touchstart', tryUnlockAutoplay, { once: true, passive: true });

    function tick() {
      if (swapping || !cur.duration) return;
      if (cur.duration - cur.currentTime > FADE) return;

      swapping = true;
      var out = cur;
      nxt.currentTime = 0;
      play(nxt);
      nxt.classList.add('is-active');
      out.classList.remove('is-active');

      var temp = cur;
      cur = nxt;
      nxt = temp;

      setTimeout(function() {
        out.pause();
        out.currentTime = 0;
        swapping = false;
      }, FADE * 1000 + 100);
    }

    vA.addEventListener('timeupdate', tick);
    vB.addEventListener('timeupdate', tick);
  }

  window.addEventListener('vv:webgl-fallback', startFallbackVideo, { once: true });
})();

// 3. Cookie Toast
(function() {
  var toast = document.getElementById('cookie-toast');
  var acceptBtn = document.getElementById('acceptCookies');
  var dismissBtn = document.getElementById('dismissCookies');
  if (!toast) return;

  try {
    if (localStorage.getItem('vv_cookies_agreed') === '1') {
      toast.style.display = 'none';
    }
  } catch (e) {}

  function closeToast() {
    toast.style.display = 'none';
    try {
      localStorage.setItem('vv_cookies_agreed', '1');
    } catch (e) {}
  }

  if (acceptBtn) acceptBtn.addEventListener('click', closeToast);
  if (dismissBtn) dismissBtn.addEventListener('click', closeToast);
})();

// 4. Branch navigation active link updates handled by Branch Router (Section 13)

// 5. Stats Number Counter Animation with IntersectionObserver
(function() {
  var statsStrip = document.querySelector('.stats-strip');
  var statElements = document.querySelectorAll('.stat-num');
  if (!statsStrip || !statElements.length) return;

  var animated = false;

  // Cubic ease-out for smooth decelerating count
  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  function startCountAnimation() {
    if (animated) return;
    animated = true;

    // Respect user's reduced motion preference
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      statElements.forEach(function(el) {
        var target = parseInt(el.getAttribute('data-target'), 10) || parseInt(el.textContent, 10);
        var suffix = el.getAttribute('data-suffix') || '+';
        el.textContent = target + suffix;
      });
      return;
    }

    var duration = 1800; // ms
    var startTime = null;

    var statsData = [];
    statElements.forEach(function(el) {
      var target = parseInt(el.getAttribute('data-target'), 10);
      if (isNaN(target)) {
        var match = el.textContent.match(/\d+/);
        target = match ? parseInt(match[0], 10) : 0;
      }
      var suffix = el.getAttribute('data-suffix') || (el.textContent.indexOf('+') !== -1 ? '+' : '');
      statsData.push({
        element: el,
        target: target,
        suffix: suffix
      });
      el.textContent = '0' + suffix;
    });

    function step(timestamp) {
      if (!startTime) startTime = timestamp;
      var elapsed = timestamp - startTime;
      var progress = Math.min(elapsed / duration, 1);
      var eased = easeOutCubic(progress);

      statsData.forEach(function(item) {
        var currentVal = Math.round(eased * item.target);
        item.element.textContent = currentVal + item.suffix;
      });

      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        statsData.forEach(function(item) {
          item.element.textContent = item.target + item.suffix;
        });
      }
    }

    requestAnimationFrame(step);
  }

  if ('IntersectionObserver' in window) {
    var observer = new IntersectionObserver(function(entries, obs) {
      entries.forEach(function(entry) {
        if (entry.isIntersecting) {
          startCountAnimation();
          obs.unobserve(entry.target);
        }
      });
    }, {
      threshold: 0.15,
      rootMargin: '0px 0px -40px 0px'
    });

    observer.observe(statsStrip);
  } else {
    startCountAnimation();
  }
})();

// 6. SCROLL REVEAL & INTERSECTION OBSERVER LAZY LOADING (PROJECTS + PARTNER LOGOS)
(function initCardScrollReveal() {
  var cardSelectors = '.pillar-card, .solution-card, .ind-card, .achieve-card';
  var cards = document.querySelectorAll(cardSelectors);

  if (cards.length) {
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) {
      cards.forEach(function(card) {
        card.classList.add('is-revealed');
      });
    } else {
      cards.forEach(function(card) {
        var parent = card.parentElement;
        if (parent) {
          var siblings = Array.prototype.slice.call(parent.children).filter(function(child) {
            return child.matches && child.matches(cardSelectors);
          });
          var idx = siblings.indexOf(card);
          if (idx !== -1) {
            card.style.transitionDelay = ((idx % 4) * 90) + 'ms';
          }
        }
      });

      var cardObserver = new IntersectionObserver(function(entries, observer) {
        entries.forEach(function(entry) {
          if (entry.isIntersecting) {
            var target = entry.target;
            target.classList.add('is-revealed');
            observer.unobserve(target);

            var currentDelay = parseFloat(target.style.transitionDelay) || 0;
            setTimeout(function() {
              target.style.transitionDelay = '0s';
            }, currentDelay + 850);
          }
        });
      }, {
        threshold: 0.12,
        rootMargin: '0px 0px -40px 0px'
      });

      cards.forEach(function(card) {
        cardObserver.observe(card);
      });
    }
  }
})();

// 6B. INTERSECTION OBSERVER LAZY LOADING FOR PROJECT CARDS, INDUSTRY MEDIA & PARTNER LOGOS
(function initLazyPortfolioAndPartners() {
  var projectCards = document.querySelectorAll('.project-card');
  var partnerTiles = document.querySelectorAll('.partner-tile');
  var industryCards = document.querySelectorAll('#industries .ind-card');

  function hydrateIndustryMedia(card) {
    var mediaBox = card.querySelector('.ind-media');
    var img = card.querySelector('.ind-img');
    if (!img) return;
    var lazySrc = img.getAttribute('data-src');
    if (lazySrc) {
      var fallbackSrc = img.getAttribute('data-fallback');
      img.onload = function() {
        img.classList.add('is-loaded');
        if (mediaBox) mediaBox.classList.remove('is-loading');
      };
      img.onerror = function() {
        if (!img.dataset.tried && fallbackSrc) {
          img.dataset.tried = '1';
          img.src = fallbackSrc;
        } else {
          if (mediaBox) mediaBox.style.display = 'none';
        }
      };
      img.removeAttribute('data-src');
      img.src = lazySrc;
    }
  }

  function hydratePartnerLogo(tile) {
    var box = tile.querySelector('.partner-logo-box');
    var img = tile.querySelector('.partner-logo-img');
    var fallbackBadge = tile.querySelector('.partner-fallback-badge');

    tile.classList.add('is-revealed');
    if (!img) return;

    var lazySrc = img.getAttribute('data-src');
    if (lazySrc) {
      var fallbackSrc = img.getAttribute('data-fallback');
      img.onload = function() {
        img.classList.add('is-loaded');
        if (box) box.classList.remove('is-loading');
      };
      img.onerror = function() {
        if (!img.dataset.tried && fallbackSrc) {
          img.dataset.tried = '1';
          img.src = fallbackSrc;
        } else {
          img.style.display = 'none';
          if (fallbackBadge) fallbackBadge.style.display = 'flex';
          if (box) box.classList.remove('is-loading');
        }
      };
      img.removeAttribute('data-src');
      img.src = lazySrc;
    }
  }

  function revealProjectCard(card, idx) {
    if (card.getAttribute('data-lazy-loaded') === 'true') return;
    card.setAttribute('data-lazy-loaded', 'true');
    var delay = ((idx || 0) % 3) * 85;
    card.style.transitionDelay = delay + 'ms';
    card.classList.add('is-revealed');
    setTimeout(function() {
      card.style.transitionDelay = '0s';
    }, delay + 800);
  }

  if (!('IntersectionObserver' in window)) {
    projectCards.forEach(function(card, idx) { revealProjectCard(card, idx); });
    partnerTiles.forEach(hydratePartnerLogo);
    industryCards.forEach(hydrateIndustryMedia);
    return;
  }

  var projectObserver = new IntersectionObserver(function(entries, obs) {
    var visibleCount = 0;
    entries.forEach(function(entry) {
      if (entry.isIntersecting) {
        revealProjectCard(entry.target, visibleCount++);
        obs.unobserve(entry.target);
      }
    });
  }, {
    root: null,
    rootMargin: '80px 0px',
    threshold: 0.08
  });

  projectCards.forEach(function(card) {
    projectObserver.observe(card);
  });

  var partnerObserver = new IntersectionObserver(function(entries, obs) {
    entries.forEach(function(entry) {
      if (entry.isIntersecting) {
        hydratePartnerLogo(entry.target);
        obs.unobserve(entry.target);
      }
    });
  }, {
    root: null,
    rootMargin: '120px 0px',
    threshold: 0.05
  });

  partnerTiles.forEach(function(tile) {
    partnerObserver.observe(tile);
  });

  var industryObserver = new IntersectionObserver(function(entries, obs) {
    entries.forEach(function(entry) {
      if (entry.isIntersecting) {
        hydrateIndustryMedia(entry.target);
        obs.unobserve(entry.target);
      }
    });
  }, {
    root: null,
    rootMargin: '120px 0px',
    threshold: 0.05
  });

  industryCards.forEach(function(card) {
    if (card.querySelector('.ind-img[data-src]')) {
      industryObserver.observe(card);
    }
  });

  // Re-observe unrevealed cards when switching branches or filters
  window.addEventListener('vv:refresh-lazy-observers', function() {
    projectCards.forEach(function(card) {
      if (card.getAttribute('data-lazy-loaded') !== 'true' && card.style.display !== 'none') {
        projectObserver.unobserve(card);
        projectObserver.observe(card);
      }
    });
    partnerTiles.forEach(function(tile) {
      var img = tile.querySelector('.partner-logo-img[data-src]');
      if (img) {
        partnerObserver.unobserve(tile);
        partnerObserver.observe(tile);
      }
    });
    industryCards.forEach(function(card) {
      var img = card.querySelector('.ind-img[data-src]');
      if (img) {
        industryObserver.unobserve(card);
        industryObserver.observe(card);
      }
    });
  });
})();

// 7. ANTI-COPY & ANTI-SELECTION PROTECTION
(function initCopyProtection() {
  // Prevent clipboard copy
  document.addEventListener('copy', function(e) {
    e.preventDefault();
    return false;
  });

  // Prevent clipboard cut
  document.addEventListener('cut', function(e) {
    e.preventDefault();
    return false;
  });

  // Prevent text selection by mouse drag
  document.addEventListener('selectstart', function(e) {
    var tag = (e.target && e.target.tagName) ? e.target.tagName.toLowerCase() : '';
    if (tag !== 'input' && tag !== 'textarea') {
      e.preventDefault();
      return false;
    }
  });

  // Prevent text / asset dragging
  document.addEventListener('dragstart', function(e) {
    var tag = (e.target && e.target.tagName) ? e.target.tagName.toLowerCase() : '';
    if (tag !== 'input' && tag !== 'textarea') {
      e.preventDefault();
      return false;
    }
  });

  // Disable right-click context menu
  document.addEventListener('contextmenu', function(e) {
    var tag = (e.target && e.target.tagName) ? e.target.tagName.toLowerCase() : '';
    if (tag !== 'input' && tag !== 'textarea') {
      e.preventDefault();
      return false;
    }
  });

  // Prevent copy/select keyboard shortcuts (Ctrl+C, Ctrl+A, Ctrl+X, Ctrl+U, Cmd+C, Cmd+A, Cmd+X)
  document.addEventListener('keydown', function(e) {
    var tag = (e.target && e.target.tagName) ? e.target.tagName.toLowerCase() : '';
    if (tag === 'input' || tag === 'textarea') return;

    var isCtrlOrCmd = e.ctrlKey || e.metaKey;
    if (isCtrlOrCmd) {
      var key = (e.key || '').toLowerCase();
      if (key === 'c' || key === 'a' || key === 'x' || key === 'u' || key === 's') {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
    }
  });

  // Continuously clear any selection highlight
  document.addEventListener('selectionchange', function() {
    var activeEl = document.activeElement;
    var tag = (activeEl && activeEl.tagName) ? activeEl.tagName.toLowerCase() : '';
    if (tag !== 'input' && tag !== 'textarea') {
      var sel = window.getSelection();
      if (sel && sel.removeAllRanges) {
        sel.removeAllRanges();
      }
    }
  });
})();

// 8. PROJECT PORTFOLIO FILTER LOGIC
(function initProjectFilters() {
  var filterBtns = document.querySelectorAll('.p-filter-btn');
  var projectCards = document.querySelectorAll('.project-card');
  if (!filterBtns.length || !projectCards.length) return;

  filterBtns.forEach(function(btn) {
    btn.addEventListener('click', function() {
      var filter = this.getAttribute('data-filter');

      filterBtns.forEach(function(b) { b.classList.remove('is-active'); });
      this.classList.add('is-active');

      projectCards.forEach(function(card) {
        var cat = card.getAttribute('data-category');
        if (filter === 'all' || cat === filter) {
          card.classList.remove('is-hidden');
          card.style.display = '';
        } else {
          card.classList.add('is-hidden');
          card.style.display = 'none';
        }
      });
      try {
        window.dispatchEvent(new Event('vv:refresh-lazy-observers'));
      } catch (err) {}
    });
  });
})();

// 9. ENTERPRISE FAQ ACCORDION
(function initFaqAccordion() {
  var faqItems = document.querySelectorAll('.faq-item');
  if (!faqItems.length) return;

  faqItems.forEach(function(item) {
    var btn = item.querySelector('.faq-question');
    if (!btn) return;

    btn.addEventListener('click', function() {
      var isOpen = item.classList.contains('is-open');

      // Close other open FAQ items for a clean accordion experience
      faqItems.forEach(function(other) {
        if (other !== item) other.classList.remove('is-open');
      });

      if (isOpen) {
        item.classList.remove('is-open');
      } else {
        item.classList.add('is-open');
      }
    });
  });
})();

// 10. SOLUTIONS ARCHITECTURE MODAL
(function initSolutionsModal() {
  var backdrop = document.getElementById('solModalBackdrop');
  var closeBtn = document.getElementById('solModalClose');
  var dismissBtn = document.getElementById('solModalDismiss');
  var tabBtns = document.querySelectorAll('.sol-tab-btn');
  var modalTitle = document.getElementById('solModalTitle');
  var modalDesc = document.getElementById('solModalDesc');
  var tabContent = document.getElementById('solTabContent');
  var triggerBtns = document.querySelectorAll('.sol-detail-btn');
  if (!backdrop || !tabContent) return;

  var currentSol = 'network';
  var currentTab = 'specs';

  var solData = {
    network: {
      tag: 'ENTERPRISE NETWORK ARCHITECTURE',
      title: 'High Throughput Core & SD WAN Infrastructure',
      desc: 'High speed backbone routing, redundant switching fabrics, structured cabling, and zero trust branch connectivity.',
      specs: [
        { label: 'Backbone Throughput', val: 'Up to 100 Gbps Core Routing' },
        { label: 'Cabling Standards', val: 'Cat6A / Cat7 & Singlemode Fiber' },
        { label: 'Topology Architecture', val: 'Spine & Leaf High Availability' },
        { label: 'Network Latency', val: 'Sub 2ms Intra Campus Switching' },
        { label: 'Redundancy Protocol', val: 'Automated Dual Link BGP Failover' },
        { label: 'Audit Certification', val: 'Fluke Versiv OTDR Tier 3 Reports' }
      ],
      bom: [
        'Cisco Catalyst 9300 / 9500 Core & Distribution Switches',
        'CommScope GigaSPEED X10D Structured Copper Cabling',
        'Panduit OptiCam Pre Terminated Singlemode Fiber',
        'MikroTik CCR2216 Carrier Grade Edge Cloud Routers',
        'APC NetShelter 42U Server Racks with Cable Organizers'
      ],
      sla: [
        '99.99% Availability Guarantee with written SLA',
        '2 Hour Rapid Emergency Onsite Dispatch across Greater Jakarta',
        '24/7 Live SNMP Telemetry & Proactive Link Monitoring',
        'Annual Preventative Firmware Hardening & Security Patching'
      ]
    },
    datacenter: {
      tag: 'MISSION CRITICAL FACILITIES',
      title: 'Data Center Facilities & Critical Power',
      desc: 'Turnkey server room design, precision in row cooling, three phase modular UPS topologies, and automated fire suppression.',
      specs: [
        { label: 'Power Redundancy', val: 'N+1 / 2N Modular UPS Topologies' },
        { label: 'Thermal Management', val: 'In Row Precision Cooling Units' },
        { label: 'Fire Suppression', val: 'Clean Agent FM200 / Novec 1230' },
        { label: 'Power Efficiency', val: 'Target PUE Under 1.4 Design' },
        { label: 'Access Security', val: 'Dual Factor Biometric Air Lock' },
        { label: 'Telemetry Monitoring', val: 'Continuous DCIM Environmental Sensors' }
      ],
      bom: [
        'Schneider Electric Galaxy Modular Three Phase UPS Systems',
        'Schneider Electric Uniflair Precision Air Handling Units',
        'Panduit SmartZone Intelligent Power Distribution Units (ePDU)',
        'FM200 Clean Agent Fire Extinguishing Automated System',
        'Gas Detection, Leak Rope Sensors, and Ambient Hygrometers'
      ],
      sla: [
        'Zero unplanned facility power loss guarantee under active SLA',
        'Quarterly preventative thermal imaging & battery health audits',
        '4 Hour critical replacement part dispatch from Jakarta stock',
        'Documented annual electrical load bank test handover'
      ]
    },
    security: {
      tag: 'UNIFIED PHYSICAL & CYBER PROTECTION',
      title: 'Integrated Enterprise Security & AI Surveillance',
      desc: 'High resolution AI analytics CCTV, turnstile speed gates, biometric identity verification, and central security operation center.',
      specs: [
        { label: 'Video Analytics', val: '4K AI License Plate & Face Recognition' },
        { label: 'Storage Retention', val: 'Redundant RAID6 90 Day Local Archive' },
        { label: 'Door Controllers', val: 'OSDP Encrypted Biometric Readers' },
        { label: 'Perimeter Defense', val: 'Infrared Barrier & Microwave Tripwire' },
        { label: 'Integration Level', val: 'Single Unified PSIM Management Console' },
        { label: 'Fail Safe Mechanism', val: 'Fire Alarm Automatic Egress Release' }
      ],
      bom: [
        'Hikvision / Hanwha Vision 4K Ultra Low Light Network Cameras',
        'Enterprise Multi Bay Network Video Recorders with Hot Spare',
        'ZKTeco Speed Gate Turnstiles with RFID & Facial Readers',
        'HID Global Seos Encrypted Smart Card Controllers',
        'Centralized Video Wall Security Operations Command Console'
      ],
      sla: [
        'Continuous 24/7 camera health check and disk failure alert',
        'Immediate remote diagnostic response within 30 minutes',
        'Scheduled optical lens cleaning and field calibration visits',
        'Strict data protection compliant access logs and storage encryption'
      ]
    },
    wireless: {
      tag: 'HIGH CAPACITY ENTERPRISE WIRELESS',
      title: 'Predictive Enterprise WiFi & Roaming',
      desc: 'High density RF propagation mapping, seamless roaming access points, hospitality captive portals, and rugged outdoor mesh.',
      specs: [
        { label: 'Wireless Protocol', val: 'WiFi 6 / WiFi 6E & Next Gen WiFi 7' },
        { label: 'Client Density', val: 'Up to 500 Active Devices per Access Point' },
        { label: 'Roaming Latency', val: 'Sub 15ms Fast Handover (802.11r/k/v)' },
        { label: 'RF Propagation', val: 'Ekahau 3D Predictive Heatmap Verification' },
        { label: 'Captive Portal', val: 'Custom Branded SMS / OTP Guest Access' },
        { label: 'Bandwidth QoS', val: 'Per User Dynamic Bandwidth Shaping' }
      ],
      bom: [
        'Ruckus BeamFlex+ Ultra Density Indoor & Outdoor APs',
        'Aruba CX Cloud Managed Multi Gigabit PoE+ Switches',
        'Ubiquiti UniFi Enterprise Gateway & Aggregation Switches',
        'Ekahau Sidekick Certified RF Spectrum Survey Toolkit',
        'Weatherproof IP67 Enclosures for Outdoor Industrial Mesh'
      ],
      sla: [
        'Guaranteed zero blind spots across approved floor layouts',
        'Over the air automated RF interference channel adaptation',
        'Quarterly wireless spectrum verification and tuning visits',
        'Next business day access point hardware swap guarantee'
      ]
    },
    smartbuilding: {
      tag: 'IOT & ENVIRONMENTAL TELEMETRY',
      title: 'Smart Building & Automated Sensor Arrays',
      desc: 'Real time environmental monitoring, water leak detection, power metering, and multi channel emergency alerts via SMS and Telegram.',
      specs: [
        { label: 'Telemetry Channels', val: 'Redundant WiFi, GSM Cellular & LoRaWAN' },
        { label: 'Sensory Types', val: 'Temperature, Humidity, Water, Gas, Voltage' },
        { label: 'Alert Dispatch', val: 'Instant Push, SMS, Telegram & Siren Relay' },
        { label: 'Power Autonomy', val: 'Internal Battery Backup up to 72 Hours' },
        { label: 'Data Refresh', val: 'Configurable 1 to 60 Second Poll Rate' },
        { label: 'BMS Integration', val: 'Standard Modbus TCP & BACnet Support' }
      ],
      bom: [
        'Industrial Grade Modbus RTU / TCP Environmental Sensor Probes',
        'Cellular IoT Multi Band Gateway with Auto SIM Failover',
        'Water Leak Detection Rope Sensors with Conductive Polymer',
        'Current Transducer (CT) Digital Power Consumption Meters',
        'High Decibel Strobe Sirens with Relay Control Modules'
      ],
      sla: [
        'Guaranteed sub 5 second emergency alert dispatch',
        'Monthly battery health and cellular signal level audits',
        'Secure encrypted MQTT / HTTPS cloud telemetry dashboard',
        'Tailored threshold profiles for specialized manufacturing sites'
      ]
    },
    maintenance: {
      tag: 'ENTERPRISE CONTINUITY & SUPPORT',
      title: '24/7 Managed Services & Guaranteed SLA',
      desc: 'Round the clock technical assistance, dedicated spare parts buffer, preventative health visits, and guaranteed incident dispatch.',
      specs: [
        { label: 'Incident Response', val: 'Under 2 Hours Onsite Dispatch in Jakarta' },
        { label: 'Support Availability', val: '24 Hours a Day, 365 Days a Year' },
        { label: 'Monitoring Center', val: 'Dedicated In House Live Operations Desk' },
        { label: 'Hardware Buffer', val: 'Local Jakarta Spare Parts Inventory Pool' },
        { label: 'Reporting Cadence', val: 'Monthly Executive Uptime & Incident Dossier' },
        { label: 'Account Ownership', val: 'Dedicated Named Senior Lead Engineer' }
      ],
      bom: [
        'Enterprise SNMP / Syslog Centralized Monitoring Platform',
        'Dedicated Hot Spare Switch, Router & Power Supply Inventory',
        'Fluke Versiv Cable Analyzer & Fiber Inspection Scopes',
        'Automated Configuration Backup & Cloud Version Repository',
        'Direct Emergency WhatsApp & Phone Escalation Hotline'
      ],
      sla: [
        '99.9% Overall Infrastructure Uptime SLA Commitment',
        'Formal SLA penalty credits for unresolved critical downtime',
        'Scheduled bi monthly preventative physical hardware servicing',
        'Executive quarterly technology review and capacity planning'
      ]
    }
  };

  function renderModalContent() {
    var data = solData[currentSol] || solData.network;
    var tagEl = document.getElementById('solModalTag');
    if (tagEl) tagEl.textContent = data.tag;
    if (modalTitle) modalTitle.textContent = data.title;
    if (modalDesc) modalDesc.textContent = data.desc;

    while (tabContent.firstChild) {
      tabContent.removeChild(tabContent.firstChild);
    }

    if (currentTab === 'specs') {
      var specGrid = document.createElement('div');
      specGrid.className = 'sol-spec-grid';
      data.specs.forEach(function(item) {
        var cell = document.createElement('div');
        cell.className = 'sol-spec-item';
        var lbl = document.createElement('span');
        lbl.className = 'sol-spec-label';
        lbl.textContent = item.label;
        var val = document.createElement('span');
        val.className = 'sol-spec-val';
        val.textContent = item.val;
        cell.appendChild(lbl);
        cell.appendChild(val);
        specGrid.appendChild(cell);
      });
      tabContent.appendChild(specGrid);
    } else if (currentTab === 'bom' || currentTab === 'sla') {
      var items = currentTab === 'bom' ? data.bom : data.sla;
      var list = document.createElement('ul');
      list.className = 'sol-modal-list';
      items.forEach(function(item) {
        var li = document.createElement('li');
        li.className = 'sol-modal-list-item';
        var mark = document.createElement('span');
        mark.style.cssText = currentTab === 'bom'
          ? 'color: var(--accent); font-weight: 700; margin-top: 1px;'
          : 'color: var(--emerald); font-weight: 700; margin-top: 1px;';
        mark.textContent = currentTab === 'bom' ? '✓' : '★';
        var txt = document.createElement('span');
        txt.textContent = item;
        li.appendChild(mark);
        li.appendChild(txt);
        list.appendChild(li);
      });
      tabContent.appendChild(list);
    }
  }

  function openModal(solKey) {
    currentSol = solKey || 'network';
    currentTab = 'specs';
    tabBtns.forEach(function(btn) {
      if (btn.getAttribute('data-tab') === 'specs') {
        btn.classList.add('is-active');
      } else {
        btn.classList.remove('is-active');
      }
    });
    renderModalContent();
    backdrop.classList.add('is-open');
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    backdrop.classList.remove('is-open');
    document.body.style.overflow = '';
  }

  triggerBtns.forEach(function(btn) {
    btn.addEventListener('click', function(e) {
      e.preventDefault();
      var solKey = this.getAttribute('data-sol');
      openModal(solKey);
    });
  });

  tabBtns.forEach(function(btn) {
    btn.addEventListener('click', function() {
      tabBtns.forEach(function(b) { b.classList.remove('is-active'); });
      this.classList.add('is-active');
      currentTab = this.getAttribute('data-tab') || 'specs';
      renderModalContent();
    });
  });

  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  if (dismissBtn) dismissBtn.addEventListener('click', closeModal);

  backdrop.addEventListener('click', function(e) {
    if (e.target === backdrop) closeModal();
  });

  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && backdrop.classList.contains('is-open')) {
      closeModal();
    }
  });
})();

// 11. EVENT TRACKING LAYER (GTM / GA4 dataLayer + CustomEvent, zero PII)
(function initConversionTracking() {
  window.dataLayer = window.dataLayer || [];

  window.__vvTrackEvent = function(eventName, params) {
    try {
      var payload = Object.assign({ event: eventName }, params || {});
      window.dataLayer.push(payload);
      if (typeof window.gtag === 'function') {
        window.gtag('event', eventName, params || {});
      }
      window.dispatchEvent(new CustomEvent('vv:track', { detail: payload }));
    } catch (err) {}
  };

  document.addEventListener('click', function(e) {
    var link = e.target && e.target.closest ? e.target.closest('a, button') : null;
    if (!link) return;

    var href = (link.getAttribute('href') || '').trim();
    var activeView = document.querySelector('.branch-view.is-active');
    var branch = activeView ? (activeView.getAttribute('data-branch') || 'home') : 'home';

    if (href.indexOf('wa.me') !== -1) {
      var waLocation = 'page';
      if (link.closest('header')) waLocation = 'header';
      else if (link.closest('#mobileMenu')) waLocation = 'mobile_drawer';
      else if (link.closest('#rfpSuccess')) waLocation = 'rfp_banner';
      else if (link.closest('#floatingBar')) waLocation = 'floating_button';
      else if (link.closest('#contact')) waLocation = 'contact_card';
      window.__vvTrackEvent('whatsapp_click', {
        cta_location: waLocation,
        branch: branch
      });
      return;
    }

    if (
      link.classList.contains('btn-primary') ||
      link.classList.contains('summary-branch-card') ||
      link.classList.contains('sol-detail-btn') ||
      (link.closest('.hero-ctas') && link.tagName === 'A')
    ) {
      var labelEl = link.querySelector('h3') || link;
      var ctaLabel = (labelEl.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 64);
      var ctaLoc = link.closest('.hero') ? 'hero'
        : link.closest('#home-summary') ? 'home_summary'
        : link.closest('header') ? 'header'
        : link.closest('#mobileMenu') ? 'mobile_drawer'
        : link.closest('#solModalBackdrop') ? 'solution_modal'
        : branch;
      window.__vvTrackEvent('cta_click', {
        cta_label: ctaLabel,
        cta_location: ctaLoc,
        target: href || link.getAttribute('data-sol') || '',
        branch: branch
      });
    }
  });
})();

// 12. INTERACTIVE RFP FORM VALIDATION, SANITIZATION, ANTI-SPAM & WHATSAPP GENERATOR
(function initRfpForm() {
  var form = document.getElementById('rfpForm');
  var errorBanner = document.getElementById('rfpError');
  var successBanner = document.getElementById('rfpSuccess');
  var waLink = document.getElementById('rfpWhatsAppLink');
  if (!form || !successBanner || !waLink) return;

  var formMountTime = Date.now();
  var COOLDOWN_MS = 30000;
  var COOLDOWN_KEY = 'vv_rfp_last_ts';

  var ALLOWED_SCOPES = {
    'Enterprise Network Infrastructure': true,
    'Data Center Facilities & Power': true,
    'Integrated Security & Surveillance': true,
    'High Density Wireless Connectivity': true,
    'Smart Building & Alarm Telemetry': true,
    'Maintenance & 24/7 SLA Service': true,
    'Multi Site Turnkey Overhaul': true
  };

  var ALLOWED_TIMELINES = {
    'Immediate within 30 days': true,
    '1 to 3 Months': true,
    '3 to 6 Months': true,
    'Fiscal Budget Planning': true
  };

  function sanitizeText(raw, maxLen, allowNewlines) {
    var str = String(raw || '');
    str = str.replace(/<[^>]*>/g, '');
    str = str.replace(/(?:javascript|vbscript|data):/gi, '');
    if (allowNewlines) {
      str = str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F\u200B-\u200D\uFEFF]/g, '');
      str = str.replace(/\r\n?/g, '\n').replace(/\n{3,}/g, '\n\n');
    } else {
      str = str.replace(/[\x00-\x1F\x7F\u200B-\u200D\uFEFF]+/g, ' ');
      str = str.replace(/\s+/g, ' ');
    }
    str = str.trim();
    if (maxLen && str.length > maxLen) {
      str = str.slice(0, maxLen).trim();
    }
    return str;
  }

  function clearFieldErrors() {
    var invalids = form.querySelectorAll('.is-invalid');
    invalids.forEach(function(el) {
      el.classList.remove('is-invalid');
      el.removeAttribute('aria-invalid');
    });
    if (errorBanner) {
      errorBanner.textContent = '';
      errorBanner.classList.remove('is-visible');
    }
  }

  function showFormError(message, fieldEl) {
    clearFieldErrors();
    if (fieldEl) {
      fieldEl.classList.add('is-invalid');
      fieldEl.setAttribute('aria-invalid', 'true');
      fieldEl.focus();
    }
    if (errorBanner) {
      errorBanner.textContent = message;
      errorBanner.classList.add('is-visible');
    }
    successBanner.classList.remove('is-visible');
  }

  form.querySelectorAll('.form-input, .form-select, .form-textarea').forEach(function(el) {
    el.addEventListener('input', function() {
      el.classList.remove('is-invalid');
      el.removeAttribute('aria-invalid');
      if (errorBanner) errorBanner.classList.remove('is-visible');
    });
  });

  form.addEventListener('submit', function(e) {
    e.preventDefault();
    clearFieldErrors();

    var honeypotEl = document.getElementById('rfpWebsite');
    if (honeypotEl && honeypotEl.value && honeypotEl.value.trim() !== '') {
      return;
    }

    if (Date.now() - formMountTime < 2500) {
      showFormError('Please take a moment to verify your project details before submitting.');
      return;
    }

    try {
      var lastSubmit = parseInt(sessionStorage.getItem(COOLDOWN_KEY) || '0', 10);
      if (lastSubmit && (Date.now() - lastSubmit) < COOLDOWN_MS) {
        var waitSec = Math.ceil((COOLDOWN_MS - (Date.now() - lastSubmit)) / 1000);
        showFormError('Please wait ' + waitSec + ' seconds before submitting another proposal request.');
        return;
      }
    } catch (err) {}

    var nameEl = document.getElementById('rfpName');
    var companyEl = document.getElementById('rfpCompany');
    var emailEl = document.getElementById('rfpEmail');
    var phoneEl = document.getElementById('rfpPhone');
    var scopeEl = document.getElementById('rfpScope');
    var timelineEl = document.getElementById('rfpTimeline');
    var detailsEl = document.getElementById('rfpDetails');

    var name = sanitizeText(nameEl ? nameEl.value : '', 80, false);
    var company = sanitizeText(companyEl ? companyEl.value : '', 120, false);
    var email = sanitizeText(emailEl ? emailEl.value : '', 120, false);
    var phone = sanitizeText(phoneEl ? phoneEl.value : '', 24, false);
    var scope = sanitizeText(scopeEl ? scopeEl.value : '', 80, false);
    var timeline = sanitizeText(timelineEl ? timelineEl.value : '', 80, false);
    var details = sanitizeText(detailsEl ? detailsEl.value : '', 1000, true);

    if (name.length < 2) {
      showFormError('Please enter your full name (minimum 2 characters).', nameEl);
      return;
    }
    if (company.length < 2) {
      showFormError('Please enter your company or institution name.', companyEl);
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      showFormError('Please enter a valid business email address.', emailEl);
      return;
    }
    var phoneDigits = phone.replace(/[^\d]/g, '');
    if (!/^\+?[\d\s()]{8,24}$/.test(phone) || phoneDigits.length < 8 || phoneDigits.length > 15) {
      showFormError('Please enter a valid phone or WhatsApp number (8 to 15 digits).', phoneEl);
      return;
    }
    if (!ALLOWED_SCOPES[scope]) {
      showFormError('Please select a valid infrastructure scope.', scopeEl);
      return;
    }
    if (!ALLOWED_TIMELINES[timeline]) {
      showFormError('Please select a valid target timeline.', timelineEl);
      return;
    }

    try {
      sessionStorage.setItem(COOLDOWN_KEY, String(Date.now()));
    } catch (err) {}

    if (typeof window.__vvTrackEvent === 'function') {
      window.__vvTrackEvent('rfp_form_submit', {
        scope: scope,
        timeline: timeline
      });
    }

    var lines = [
      'PROJECT RFP CONSULTATION REQUEST',
      'PT. VIER VIRYA VENTURES',
      '',
      'Full Name: ' + name,
      'Company: ' + company,
      'Email: ' + email,
      'Phone: ' + phone,
      'Scope: ' + scope,
      'Timeline: ' + timeline,
      'Details: ' + (details || 'Site consultation requested')
    ];

    var encodedText = encodeURIComponent(lines.join('\n'));
    var whatsappUrl = 'https://wa.me/6285157988002?text=' + encodedText;

    waLink.setAttribute('href', whatsappUrl);
    successBanner.classList.add('is-visible');
    successBanner.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });
})();

// 13. TOP SCROLL PROGRESS BAR & FLOATING BACK TO TOP
(function initScrollIndicators() {
  var btn = document.getElementById('btnBackToTop');
  var progressBar = document.getElementById('scrollProgressBar');
  var ticking = false;

  function updateScrollUI() {
    ticking = false;
    var scrollTop = window.pageYOffset || document.documentElement.scrollTop || 0;

    if (btn) {
      if (scrollTop > 380) {
        btn.classList.add('is-visible');
      } else {
        btn.classList.remove('is-visible');
      }
    }

    if (progressBar) {
      var docHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (docHeight <= 0 || scrollTop <= 2) {
        progressBar.style.transform = 'scaleX(0)';
        progressBar.classList.remove('is-active');
      } else {
        var ratio = Math.min(Math.max(scrollTop / docHeight, 0), 1);
        progressBar.style.transform = 'scaleX(' + ratio.toFixed(4) + ')';
        progressBar.classList.add('is-active');
      }
    }
  }

  function requestUpdate() {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(updateScrollUI);
    }
  }

  window.addEventListener('scroll', requestUpdate, { passive: true });
  window.addEventListener('resize', requestUpdate, { passive: true });
  window.addEventListener('vv:branch-activated', function() {
    setTimeout(updateScrollUI, 50);
  });

  updateScrollUI();

  if (btn) {
    btn.addEventListener('click', function(e) {
      e.preventDefault();
      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    });
  }
})();

// 14. DEDICATED BRANCH ROUTER, BREADCRUMB SCHEMA & CLEANUP LEGACY LOGO OVERRIDE
(function initBranchRouter() {
  try {
    localStorage.removeItem('vv_custom_logo');
  } catch (err) {}

  var VALID_BRANCHES = {
    home: 'home',
    solutions: 'solutions',
    why: 'why',
    certifications: 'why',
    industries: 'industries',
    projects: 'projects',
    partners: 'partners',
    faq: 'faq',
    contact: 'contact'
  };

  var BRANCH_LABELS = {
    home: 'Home',
    solutions: 'Solutions',
    why: 'Why Us',
    industries: 'Industries',
    projects: 'Projects',
    partners: 'Partners',
    faq: 'FAQ',
    contact: 'Contact'
  };

  var views = document.querySelectorAll('.branch-view');
  var navLinks = document.querySelectorAll('.nav-links a, .mobile-menu a[data-branch-link]');
  var mobileMenu = document.getElementById('mobileMenu');
  var solModal = document.getElementById('solModalBackdrop');

  function resolveBranch(rawHash) {
    var clean = (rawHash || '').replace(/^#\/?/, '').trim().toLowerCase();
    if (VALID_BRANCHES[clean]) return VALID_BRANCHES[clean];
    try {
      var qBranch = new URLSearchParams(window.location.search).get('branch');
      if (qBranch) {
        var qClean = qBranch.trim().toLowerCase();
        if (VALID_BRANCHES[qClean]) return VALID_BRANCHES[qClean];
      }
    } catch (err) {}
    return 'home';
  }

  function updateBreadcrumbSchema(branch) {
    try {
      var schemaEl = document.getElementById('structuredDataGraph');
      if (!schemaEl) return;
      var parsed = JSON.parse(schemaEl.textContent || '{}');
      if (!Array.isArray(parsed['@graph'])) return;
      var baseUrl = (window.location.protocol === 'http:' || window.location.protocol === 'https:')
        ? (window.location.origin + window.location.pathname)
        : 'https://vierventures.com/';
      var crumbs = [
        { '@type': 'ListItem', position: 1, name: 'Home', item: baseUrl }
      ];
      if (branch && branch !== 'home') {
        crumbs.push({
          '@type': 'ListItem',
          position: 2,
          name: BRANCH_LABELS[branch] || branch,
          item: baseUrl + '#' + branch
        });
      }
      parsed['@graph'].forEach(function(node) {
        if (node && node['@type'] === 'BreadcrumbList') {
          node.itemListElement = crumbs;
        }
      });
      schemaEl.textContent = JSON.stringify(parsed);
    } catch (err) {}
  }

  function revealBranchCards(container) {
    if (!container) return;
    var cards = container.querySelectorAll('.pillar-card, .solution-card, .ind-card, .achieve-card');
    cards.forEach(function(card, idx) {
      card.style.transitionDelay = ((idx % 4) * 55) + 'ms';
      card.classList.add('is-revealed');
      setTimeout(function() {
        card.style.transitionDelay = '0s';
      }, 550);
    });
  }

  function navigateToBranch(branchName, updateUrl) {
    var target = VALID_BRANCHES[branchName] || 'home';

    views.forEach(function(view) {
      if (view.getAttribute('data-branch') === target) {
        view.classList.add('is-active');
        revealBranchCards(view);
      } else {
        view.classList.remove('is-active');
      }
    });

    navLinks.forEach(function(link) {
      var linkBranch = link.getAttribute('data-branch-link') || resolveBranch(link.getAttribute('href'));
      if (linkBranch === target) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });

    if (typeof window.__vvCloseMobileMenu === 'function') {
      window.__vvCloseMobileMenu();
    } else if (mobileMenu) {
      mobileMenu.classList.remove('open');
    }
    if (solModal && solModal.classList.contains('is-open')) {
      solModal.classList.remove('is-open');
      document.body.style.overflow = '';
    }

    if (updateUrl) {
      var nextHash = '#' + target;
      if (window.location.hash !== nextHash) {
        if (window.history && typeof window.history.pushState === 'function') {
          window.history.pushState(null, '', nextHash);
        } else {
          window.location.hash = nextHash;
        }
      }
    }

    updateBreadcrumbSchema(target);

    window.scrollTo({ top: 0, behavior: 'auto' });

    try {
      window.dispatchEvent(new CustomEvent('vv:branch-activated', { detail: { branch: target } }));
      window.dispatchEvent(new Event('vv:refresh-lazy-observers'));
    } catch (err) {}

    // Notify Three.js Globe to recalculate dimensions
    setTimeout(function() {
      window.dispatchEvent(new Event('resize'));
    }, 45);
    setTimeout(function() {
      window.dispatchEvent(new Event('resize'));
    }, 160);
  }

  // Safety timeout so globe hero skeleton fades cleanly even if WebGL is unavailable
  setTimeout(function() {
    var globeSk = document.getElementById('hero-globe-skeleton');
    if (globeSk) globeSk.classList.add('is-loaded');
  }, 2400);

  document.addEventListener('click', function(e) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
      return;
    }
    var anchor = e.target && e.target.closest ? e.target.closest('a[href^="#"]') : null;
    if (!anchor) return;

    var href = anchor.getAttribute('href') || '';
    if (!href || href === '#') return;

    var cleanKey = href.replace(/^#\/?/, '').trim().toLowerCase();
    if (VALID_BRANCHES[cleanKey]) {
      e.preventDefault();
      navigateToBranch(VALID_BRANCHES[cleanKey], true);
    }
  });

  window.addEventListener('hashchange', function() {
    navigateToBranch(resolveBranch(window.location.hash), false);
  });

  navigateToBranch(resolveBranch(window.location.hash), false);
})();

// 15. USER-CONTROLLED DARK / HIGH-CONTRAST LIGHT THEME TOGGLE (persisted in localStorage)
(function initThemeToggle() {
  var THEME_KEY = 'vv_theme';
  var toggleBtns = document.querySelectorAll('[data-theme-toggle]');
  if (!toggleBtns.length) return;

  function applyTheme(theme, persist) {
    var nextTheme = theme === 'light' ? 'light' : 'dark';
    var isLight = nextTheme === 'light';

    document.documentElement.setAttribute('data-theme', nextTheme);

    var metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
      metaTheme.setAttribute('content', isLight ? '#f8fafc' : '#07070a');
    }

    toggleBtns.forEach(function(btn) {
      btn.setAttribute('aria-pressed', isLight ? 'true' : 'false');
      btn.setAttribute('aria-label', isLight ? 'Switch to dark mode' : 'Switch to high contrast light mode');
      var lbl = btn.querySelector('[data-theme-label]');
      if (lbl) {
        lbl.textContent = isLight ? 'High Contrast Light' : 'Dark Mode';
      }
    });

    if (persist) {
      try {
        localStorage.setItem(THEME_KEY, nextTheme);
      } catch (err) {}
      if (typeof window.__vvTrackEvent === 'function') {
        window.__vvTrackEvent('theme_toggle', { theme: nextTheme });
      }
    }

    try {
      window.dispatchEvent(new CustomEvent('vv:theme-change', { detail: { theme: nextTheme } }));
    } catch (err) {}
  }

  var initialTheme = document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
  applyTheme(initialTheme, false);

  toggleBtns.forEach(function(btn) {
    btn.addEventListener('click', function() {
      var current = document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
      applyTheme(current === 'light' ? 'dark' : 'light', true);
    });
  });
})();

var globeLoaded = false;
function bootHeroGlobe() {
  if (globeLoaded) return;
  var branchHome = document.getElementById('branch-home');
  if (branchHome && !branchHome.classList.contains('is-active')) return;
  globeLoaded = true;

  import('./globe.ts')
    .then(function(mod) {
      if (mod && typeof mod.initHeroGlobe === 'function') {
        mod.initHeroGlobe();
      }
    })
    .catch(function() {
      var sk = document.getElementById('hero-globe-skeleton');
      if (sk) sk.classList.add('is-loaded');
      window.dispatchEvent(new Event('vv:webgl-fallback'));
    });
}

function scheduleGlobeBoot() {
  requestAnimationFrame(function() {
    if ('requestIdleCallback' in window) {
      window.requestIdleCallback(bootHeroGlobe, { timeout: 140 });
    } else {
      setTimeout(bootHeroGlobe, 40);
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', scheduleGlobeBoot, { once: true });
} else {
  scheduleGlobeBoot();
}

window.addEventListener('vv:branch-activated', function(e) {
  if (!globeLoaded && e && e.detail && e.detail.branch === 'home') {
    bootHeroGlobe();
  }
});
