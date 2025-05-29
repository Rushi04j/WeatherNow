// API Key for OpenWeatherMap
const API_KEY = CONFIG.WEATHER_API_KEY;
const BASE_URL = "https://api.openweathermap.org/data/2.5"
const GEO_URL = "https://api.openweathermap.org/geo/1.0"

// DOM Elements
const searchInput = document.getElementById("search-input")
const searchBtn = document.getElementById("search-btn")
const locationBtn = document.getElementById("location-btn")
const celsiusBtn = document.getElementById("celsius")
const fahrenheitBtn = document.getElementById("fahrenheit")
const loader = document.getElementById("loader")
const errorContainer = document.getElementById("error-container")
const errorMessage = document.getElementById("error-message")
const weatherContainer = document.getElementById("weather-container")
const themeToggleBtn = document.getElementById("theme-toggle-btn")
const themeIcon = document.getElementById("theme-icon")

// Weather Display Elements
const cityElement = document.getElementById("city")
const dateTimeElement = document.getElementById("date-time")
const weatherIconLarge = document.getElementById("weather-icon-large")
const temperatureElement = document.getElementById("temperature")
const feelsLikeElement = document.getElementById("feels-like")
const weatherDescriptionElement = document.getElementById("weather-description")
const windSpeedElement = document.getElementById("wind-speed")
const humidityElement = document.getElementById("humidity")
const visibilityElement = document.getElementById("visibility")
const pressureElement = document.getElementById("pressure")
const hourlyContainer = document.getElementById("hourly-container")
const forecastCards = document.getElementById("forecast-cards")
const aqiIndicator = document.getElementById("aqi-indicator")
const aqiDescription = document.getElementById("aqi-description")
const alertsContainer = document.getElementById("alerts-container")
const sunriseTime = document.getElementById("sunrise-time")
const sunsetTime = document.getElementById("sunset-time")
const sunPosition = document.getElementById("sun-position")

// Global variables
let currentUnit = "metric" // Default to Celsius
let weatherData = null
let currentCity = null
let recentSearches = []
let weatherMap = null
let mapMarker = null
let historyChart = null
let weatherHistory = []
let currentWeatherLayer = null // Track current weather layer
// Add these to your existing global exports:
window.handleSearch = handleSearch;
window.changeUnit = changeUnit;
window.toggleTheme = toggleTheme;
window.switchTab = switchTab;
window.changeMapLayer = changeMapLayer;

// Notification system
let notificationPermission = "default"
const alertNotifications = new Set() // Track sent notifications to avoid duplicates

// Request notification permission
async function requestNotificationPermission() {
  if ("Notification" in window) {
    try {
      const permission = await Notification.requestPermission()
      notificationPermission = permission
      console.log("Notification permission:", permission)

      if (permission === "granted") {
        showSuccessMessage("Weather alerts enabled! You'll be notified of severe weather.")
      } else if (permission === "denied") {
        showError("Notifications blocked. Enable them in browser settings for weather alerts.")
      }

      return permission
    } catch (error) {
      console.error("Error requesting notification permission:", error)
      return "denied"
    }
  } else {
    console.warn("Notifications not supported in this browser")
    return "denied"
  }
}

// Check and send weather alert notifications
function checkWeatherAlerts(alerts) {
  if (!alerts || alerts.length === 0) return

  if (notificationPermission !== "granted") {
    // Show in-app prompt to enable notifications
    showNotificationPrompt()
    return
  }

  alerts.forEach((alert) => {
    const alertId = `${alert.event}_${alert.start}`

    // Don't send duplicate notifications
    if (alertNotifications.has(alertId)) return

    // Check if alert is severe enough to notify
    if (isSevereAlert(alert)) {
      sendWeatherNotification(alert)
      alertNotifications.add(alertId)

      // Remove from set after 24 hours to allow re-notification if alert persists
      setTimeout(
        () => {
          alertNotifications.delete(alertId)
        },
        24 * 60 * 60 * 1000,
      )
    }
  })
}

// Determine if alert is severe enough for notification
function isSevereAlert(alert) {
  const severeEvents = [
    "tornado",
    "hurricane",
    "typhoon",
    "cyclone",
    "severe thunderstorm",
    "flash flood",
    "blizzard",
    "ice storm",
    "extreme cold",
    "extreme heat",
    "high wind",
    "dust storm",
    "wildfire",
  ]

  const eventLower = alert.event.toLowerCase()
  return severeEvents.some((severe) => eventLower.includes(severe))
}

// Send weather notification
function sendWeatherNotification(alert) {
  if (!("Notification" in window) || notificationPermission !== "granted") return

  const title = `⚠️ Weather Alert: ${alert.event}`
  const body = alert.description.length > 100 ? alert.description.substring(0, 100) + "..." : alert.description

  const options = {
    body: body,
    icon: getAlertIcon(alert.event),
    badge: "/favicon.ico",
    tag: `weather-alert-${alert.event}`,
    requireInteraction: true,
    actions: [
      {
        action: "view",
        title: "View Details",
      },
      {
        action: "dismiss",
        title: "Dismiss",
      },
    ],
    data: {
      alert: alert,
      timestamp: Date.now(),
    },
  }

  try {
    const notification = new Notification(title, options)

    notification.onclick = () => {
      window.focus()
      // Switch to current tab and scroll to alerts
      switchTab("current")
      setTimeout(() => {
        const alertsSection = document.getElementById("weather-alerts")
        if (alertsSection) {
          alertsSection.scrollIntoView({ behavior: "smooth" })
          alertsSection.classList.add("highlight-alert")
          setTimeout(() => {
            alertsSection.classList.remove("highlight-alert")
          }, 3000)
        }
      }, 500)
      notification.close()
    }

    notification.onclose = () => {
      console.log("Weather alert notification closed")
    }

    // Auto-close after 30 seconds for non-critical alerts
    if (!isCriticalAlert(alert)) {
      setTimeout(() => {
        notification.close()
      }, 30000)
    }
  } catch (error) {
    console.error("Error sending notification:", error)
  }
}

// Check if alert is critical (should not auto-close)
function isCriticalAlert(alert) {
  const criticalEvents = ["tornado", "hurricane", "typhoon", "flash flood"]
  const eventLower = alert.event.toLowerCase()
  return criticalEvents.some((critical) => eventLower.includes(critical))
}

// Get appropriate icon for alert type
function getAlertIcon(eventType) {
  const eventLower = eventType.toLowerCase()

  if (eventLower.includes("tornado")) return "🌪️"
  if (eventLower.includes("hurricane") || eventLower.includes("typhoon")) return "🌀"
  if (eventLower.includes("flood")) return "🌊"
  if (eventLower.includes("fire")) return "🔥"
  if (eventLower.includes("snow") || eventLower.includes("blizzard")) return "❄️"
  if (eventLower.includes("thunder")) return "⛈️"
  if (eventLower.includes("wind")) return "💨"
  if (eventLower.includes("heat")) return "🌡️"
  if (eventLower.includes("cold")) return "🥶"

  return "⚠️" // Default warning icon
}

// Show notification permission prompt
function showNotificationPrompt() {
  const existingPrompt = document.querySelector(".notification-prompt")
  if (existingPrompt) return // Don't show multiple prompts

  const promptDiv = document.createElement("div")
  promptDiv.className = "notification-prompt"
  promptDiv.innerHTML = `
    <div class="prompt-content">
      <i class="fas fa-bell"></i>
      <h3>Enable Weather Alerts</h3>
      <p>Get notified about severe weather conditions in your area</p>
      <div class="prompt-buttons">
        <button onclick="enableNotifications()" class="enable-btn">
          <i class="fas fa-bell"></i> Enable Alerts
        </button>
        <button onclick="dismissNotificationPrompt()" class="dismiss-btn">
          Maybe Later
        </button>
      </div>
    </div>
  `

  // Insert after search container
  const searchContainer = document.querySelector(".search-container")
  searchContainer.parentNode.insertBefore(promptDiv, searchContainer.nextSibling)

  // Auto-dismiss after 10 seconds
  setTimeout(() => {
    if (document.contains(promptDiv)) {
      promptDiv.remove()
    }
  }, 10000)
}

// Enable notifications function (called from button)
async function enableNotifications() {
  const permission = await requestNotificationPermission()

  if (permission === "granted") {
    // Send a test notification
    sendTestNotification()
  }

  // Remove the prompt
  const prompt = document.querySelector(".notification-prompt")
  if (prompt) prompt.remove()
}

// Dismiss notification prompt
function dismissNotificationPrompt() {
  const prompt = document.querySelector(".notification-prompt")
  if (prompt) prompt.remove()
}

// Send test notification
function sendTestNotification() {
  if (notificationPermission === "granted") {
    const notification = new Notification("🌤️ Weather Alerts Enabled!", {
      body: "You'll now receive notifications for severe weather in your area.",
      icon: "🌤️",
      tag: "test-notification",
    })

    setTimeout(() => {
      notification.close()
    }, 5000)
  }
}

// Show success message
function showSuccessMessage(message) {
  const successDiv = document.createElement("div")
  successDiv.className = "success-container"
  successDiv.innerHTML = `<p>${message}</p>`

  const container = document.querySelector(".container")
  const firstChild = container.firstChild
  container.insertBefore(successDiv, firstChild)

  // Auto-remove after 5 seconds
  setTimeout(() => {
    if (document.contains(successDiv)) {
      successDiv.remove()
    }
  }, 5000)
}

// Daily weather summary notification
function scheduleDailyWeatherSummary() {
  if (notificationPermission !== "granted") return

  // Check if user wants daily summaries (you could add a setting for this)
  const wantsDailySummary = localStorage.getItem("dailyWeatherSummary") !== "false"
  if (!wantsDailySummary) return

  // Schedule for 8 AM daily
  const now = new Date()
  const tomorrow8AM = new Date()
  tomorrow8AM.setDate(now.getDate() + 1)
  tomorrow8AM.setHours(8, 0, 0, 0)

  const timeUntil8AM = tomorrow8AM.getTime() - now.getTime()

  setTimeout(() => {
    sendDailyWeatherSummary()
    // Schedule next day
    setInterval(sendDailyWeatherSummary, 24 * 60 * 60 * 1000)
  }, timeUntil8AM)
}

// Send daily weather summary
function sendDailyWeatherSummary() {
  if (!weatherData || notificationPermission !== "granted") return

  const { current } = weatherData
  const temp = Math.round(current.main.temp)
  const condition = current.weather[0].description
  const city = current.name

  const title = `🌤️ Today's Weather in ${city}`
  const body = `${temp}° - ${capitalizeFirstLetter(condition)}. Have a great day!`

  const notification = new Notification(title, {
    body: body,
    icon: "🌤️",
    tag: "daily-summary",
  })

  setTimeout(() => {
    notification.close()
  }, 10000)
}

// Event Listeners
document.addEventListener("DOMContentLoaded", () => {
  console.log("DOM loaded, setting up event listeners...")

  // Check if there's a saved theme preference
  const savedTheme = localStorage.getItem("theme")
  if (savedTheme) {
    document.documentElement.setAttribute("data-theme", savedTheme)
    updateThemeIcon(savedTheme)
  }

  // Load recent searches
  loadRecentSearches()

  // Set up event listeners
  if (searchBtn) {
    searchBtn.addEventListener("click", handleSearch)
    console.log("Search button listener added")
  }

  if (searchInput) {
    searchInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") handleSearch()
    })
    console.log("Search input listener added")
  }

  if (locationBtn) {
    locationBtn.addEventListener("click", getUserLocation)
    console.log("Location button listener added")
  }

  if (celsiusBtn) {
    celsiusBtn.addEventListener("click", () => changeUnit("metric"))
  }

  if (fahrenheitBtn) {
    fahrenheitBtn.addEventListener("click", () => changeUnit("imperial"))
  }

  if (themeToggleBtn) {
    themeToggleBtn.addEventListener("click", toggleTheme)
    console.log("Theme toggle listener added")
  }
  const clearHistoryBtn = document.getElementById("clear-history");
if (clearHistoryBtn) {
  clearHistoryBtn.addEventListener("click", () => {
    localStorage.removeItem("weatherHistory");
    weatherHistory = [];
    updateHistoryDisplay();
    showSuccessMessage("Weather history cleared!");
  });
}

  // Tab navigation
  const tabButtons = document.querySelectorAll(".tab-btn")
  tabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const tabName = button.getAttribute("data-tab")
      switchTab(tabName)
    })
  })

  // Map layer options
  const mapOptions = document.querySelectorAll(".map-option")
  mapOptions.forEach((option) => {
    option.addEventListener("click", () => {
      const layer = option.getAttribute("data-layer")
      changeMapLayer(layer)
    })
  })

  // Create weather animation background
  createWeatherAnimation()

  // Check if there's a saved location, otherwise show location prompt
  const savedLocation = localStorage.getItem("weatherLocation")
  if (savedLocation) {
    searchInput.value = savedLocation
    getWeatherByCity(savedLocation)
  } else {
    // Show a message encouraging user to use location
    showLocationPrompt()
  }

  // Initialize notifications
  if ("Notification" in window) {
    notificationPermission = Notification.permission

    // If permission already granted, don't show prompt
    if (notificationPermission === "default") {
      // Show prompt after a delay to not overwhelm user
      setTimeout(() => {
        if (
          weatherData &&
          weatherData.forecast &&
          weatherData.forecast.alerts &&
          weatherData.forecast.alerts.length > 0
        ) {
          showNotificationPrompt()
        }
      }, 5000)
    }

    // Schedule daily weather summary
    scheduleDailyWeatherSummary()
  }

  // History controls
  const historyPeriod = document.getElementById("history-period")
  const refreshHistory = document.getElementById("refresh-history")

  if (historyPeriod) {
    historyPeriod.addEventListener("change", updateHistoryDisplay)
  }

  if (refreshHistory) {
    refreshHistory.addEventListener("click", () => {
      if (currentCity) {
        getWeatherByCoords(currentCity.lat, currentCity.lon)
      }
    })
  }

  // Load weather history
  loadWeatherHistory()
})

// Show location prompt
function showLocationPrompt() {
  const promptDiv = document.createElement("div")
  promptDiv.className = "location-prompt"
  promptDiv.innerHTML = `
    <div class="prompt-content">
      <i class="fas fa-location-dot"></i>
      <h3>Get Weather for Your Location</h3>
      <p>Click the location button to get weather for your current location, or search for a city.</p>
      <button onclick="getUserLocation()" class="location-prompt-btn">
        <i class="fas fa-location-dot"></i> Use My Location
      </button>
    </div>
  `

  // Insert before weather container
  const container = document.querySelector(".container")
  const weatherContainer = document.getElementById("weather-container")
  container.insertBefore(promptDiv, weatherContainer)
}

// Toggle theme
function toggleTheme() {
  console.log("Theme toggle clicked")
  const currentTheme = document.documentElement.getAttribute("data-theme") || "light"
  const newTheme = currentTheme === "light" ? "dark" : "light"

  document.documentElement.setAttribute("data-theme", newTheme)
  localStorage.setItem("theme", newTheme)

  updateThemeIcon(newTheme)
  console.log(`Theme changed to: ${newTheme}`)
}

// Update theme icon
function updateThemeIcon(theme) {
  if (themeIcon) {
    if (theme === "dark") {
      themeIcon.className = "fas fa-sun"
    } else {
      themeIcon.className = "fas fa-moon"
    }
  }
}

// Switch tabs
function switchTab(tabName) {
  console.log(`Switching to tab: ${tabName}`)

  // Update active tab button
  const tabButtons = document.querySelectorAll(".tab-btn")
  tabButtons.forEach((button) => {
    if (button.getAttribute("data-tab") === tabName) {
      button.classList.add("active")
    } else {
      button.classList.remove("active")
    }
  })

  // Show selected tab content
  const tabContents = document.querySelectorAll(".tab-content")
  tabContents.forEach((content) => {
    if (content.id === `${tabName}-tab`) {
      content.style.display = "block"
    } else {
      content.style.display = "none"
    }
  })

  // Initialize map when switching to map tab
  if (tabName === "map" && currentCity && !weatherMap) {
    setTimeout(() => {
      initWeatherMap(currentCity.lat, currentCity.lon)
    }, 100)
  }

  // Update history when switching to history tab
  if (tabName === "history") {
    updateHistoryDisplay()
  }
}

// Initialize weather map
function initWeatherMap(lat, lon) {
  const mapContainer = document.getElementById("weather-map")

  // Clear existing content
  mapContainer.innerHTML = ""

  try {
    // Create map
    weatherMap = window.L.map("weather-map").setView([lat, lon], 6)

    // Add base tile layer
    window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(weatherMap)

    // Add marker for current location
    mapMarker = window.L.marker([lat, lon])
      .addTo(weatherMap)
      .bindPopup(`Weather for ${currentCity ? currentCity.name : "Current Location"}`)
      .openPopup()

    // Add initial weather layer (temperature)
    addWeatherLayer("temp")

    console.log("Weather map initialized successfully")
  } catch (error) {
    console.error("Error initializing weather map:", error)
    mapContainer.innerHTML = `
      <div class="map-placeholder">
        <i class="fas fa-exclamation-triangle"></i>
        <p>Unable to load map. Please try again later.</p>
      </div>
    `
  }
}

// Update map location
function updateMapLocation() {
  if (!weatherMap || !currentCity) return

  try {
    // Update map view
    weatherMap.setView([currentCity.lat, currentCity.lon], 6)

    // Update marker position and popup content
    if (mapMarker) {
      mapMarker
        .setLatLng([currentCity.lat, currentCity.lon])
        .setPopupContent(`Weather for ${currentCity.name}`)
        .openPopup()
    } else {
      mapMarker = window.L.marker([currentCity.lat, currentCity.lon])
        .addTo(weatherMap)
        .bindPopup(`Weather for ${currentCity.name}`)
        .openPopup()
    }

    console.log("Map location updated successfully")
  } catch (error) {
    console.error("Error updating map location:", error)
  }
}

// Add weather layer to map
function addWeatherLayer(layer) {
  if (!weatherMap) {
    console.warn("Weather map not initialized")
    return
  }

  try {
    // Remove existing weather layer
    if (currentWeatherLayer) {
      weatherMap.removeLayer(currentWeatherLayer)
      currentWeatherLayer = null
    }

    // Map layer types to OpenWeatherMap layer names
    const layerMap = {
      temp: "temp_new",
      clouds: "clouds_new",
      precipitation: "precipitation_new",
      wind: "wind_new",
    }

    const layerName = layerMap[layer] || "temp_new"

    // Create new weather layer
    const overlayUrl = `https://tile.openweathermap.org/map/${layerName}/{z}/{x}/{y}.png?appid=${API_KEY}`

    currentWeatherLayer = window.L.tileLayer(overlayUrl, {
      attribution: '&copy; <a href="https://openweathermap.org">OpenWeatherMap</a>',
      opacity: 0.7,
      detectRetina: true,
      maxZoom: 18,
    })

    // Add layer to map
    currentWeatherLayer.addTo(weatherMap)

    // Update current layer text
    const currentLayerElement = document.getElementById("current-layer")
    if (currentLayerElement) {
      const layerNames = {
        temp: "temperature",
        clouds: "cloud coverage",
        precipitation: "precipitation",
        wind: "wind speed",
      }
      currentLayerElement.textContent = layerNames[layer] || "temperature"
    }

    console.log(`Weather layer '${layer}' added successfully`)
  } catch (error) {
    console.error(`Error adding weather layer '${layer}':`, error)
  }
}

// Change map layer
function changeMapLayer(layer) {
  console.log(`Changing map layer to: ${layer}`)

  // Initialize map if it doesn't exist and we have location data
  if (!weatherMap && currentCity) {
    initWeatherMap(currentCity.lat, currentCity.lon)
    // Wait a bit for map to initialize before adding layer
    setTimeout(() => {
      addWeatherLayer(layer)
    }, 500)
  } else if (weatherMap) {
    // Add the selected weather layer
    addWeatherLayer(layer)
  } else {
    console.warn("Cannot change map layer: no location data available")
    return
  }

  // Update UI - remove active class from all options
  const mapOptions = document.querySelectorAll(".map-option")
  mapOptions.forEach((option) => {
    option.classList.remove("active")
  })

  // Add active class to selected option
  const selectedOption = document.querySelector(`[data-layer="${layer}"]`)
  if (selectedOption) {
    selectedOption.classList.add("active")
  }
}

// History functionality
function saveWeatherToHistory(weatherData) {
  if (!weatherData || !weatherData.current) return

  const today = new Date().toDateString()
  const historyEntry = {
    date: today,
    temperature: Math.round(weatherData.current.main.temp),
    humidity: weatherData.current.main.humidity,
    conditions: weatherData.current.weather[0].description,
    city: weatherData.current.name,
    timestamp: Date.now(),
  }

  // Load existing history
  const savedHistory = localStorage.getItem("weatherHistory")
  let history = savedHistory ? JSON.parse(savedHistory) : []

  // Remove existing entry for today (if any)
  history = history.filter((entry) => entry.date !== today || entry.city !== historyEntry.city)

  // Add new entry
  history.unshift(historyEntry)

  // Keep only last 30 days
  history = history.slice(0, 30)

  // Save to localStorage
  localStorage.setItem("weatherHistory", JSON.stringify(history))
  weatherHistory = history
}

function loadWeatherHistory() {
  const savedHistory = localStorage.getItem("weatherHistory")
  weatherHistory = savedHistory ? JSON.parse(savedHistory) : []
  updateHistoryDisplay()
}

function updateHistoryDisplay() {
  const period = Number.parseInt(document.getElementById("history-period")?.value || 7)
  const filteredHistory = weatherHistory.slice(0, period)

  if (filteredHistory.length === 0) {
    // Show placeholder data
    document.getElementById("avg-temp").textContent = "--°"
    document.getElementById("max-temp").textContent = "--°"
    document.getElementById("min-temp").textContent = "--°"
    document.getElementById("avg-humidity").textContent = "--%"

    const tableBody = document.getElementById("history-table-body")
    if (tableBody) {
      tableBody.innerHTML =
        '<tr><td colspan="4" style="text-align: center; color: var(--muted-text);">No history data available. Weather data will be saved as you use the app.</td></tr>'
    }
    return
  }

  // Calculate statistics
  const temps = filteredHistory.map((h) => h.temperature)
  const humidities = filteredHistory.map((h) => h.humidity)

  const avgTemp = Math.round(temps.reduce((a, b) => a + b, 0) / temps.length)
  const maxTemp = Math.max(...temps)
  const minTemp = Math.min(...temps)
  const avgHumidity = Math.round(humidities.reduce((a, b) => a + b, 0) / humidities.length)

  // Update stats
  document.getElementById("avg-temp").textContent = `${avgTemp}°`
  document.getElementById("max-temp").textContent = `${maxTemp}°`
  document.getElementById("min-temp").textContent = `${minTemp}°`
  document.getElementById("avg-humidity").textContent = `${avgHumidity}%`

  // Update table
  const tableBody = document.getElementById("history-table-body")
  if (tableBody) {
    tableBody.innerHTML = filteredHistory
      .map(
        (entry) => `
      <tr>
        <td>${new Date(entry.timestamp).toLocaleDateString()}</td>
        <td>${entry.temperature}°</td>
        <td>${entry.humidity}%</td>
        <td>${capitalizeFirstLetter(entry.conditions)}</td>
      </tr>
    `,
      )
      .join("")
  }

  // Update chart
  updateHistoryChart(filteredHistory)
}

function updateHistoryChart(data) {
  const canvas = document.getElementById("temperature-chart")
  if (!canvas) return

  const ctx = canvas.getContext("2d")

  // Destroy existing chart
  if (historyChart) {
    historyChart.destroy()
  }

  if (data.length === 0) return

  const labels = data.reverse().map((entry) => new Date(entry.timestamp).toLocaleDateString())
  const temperatures = data.map((entry) => entry.temperature)

  historyChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: labels,
      datasets: [
        {
          label: "Temperature (°C)",
          data: temperatures,
          borderColor: "rgb(67, 97, 238)",
          backgroundColor: "rgba(67, 97, 238, 0.1)",
          tension: 0.4,
          fill: true,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: false,
          grid: {
            color: "rgba(0, 0, 0, 0.1)",
          },
        },
        x: {
          grid: {
            color: "rgba(0, 0, 0, 0.1)",
          },
        },
      },
      plugins: {
        legend: {
          display: false,
        },
      },
    },
  })
}

// Handle search
function handleSearch() {
  console.log("Search button clicked")
  const city = searchInput.value.trim()
  if (city) {
    console.log(`Searching for: ${city}`)
    getWeatherByCity(city)
    addToRecentSearches(city)
  } else {
    showError("Please enter a city name")
  }
}

// Get user's current location
function getUserLocation() {
  console.log("Location button clicked")

  if (navigator.geolocation) {
    showLoader()
    console.log("Getting user location...")

    // Remove location prompt if it exists
    const locationPrompt = document.querySelector(".location-prompt")
    if (locationPrompt) {
      locationPrompt.remove()
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        console.log("Location obtained:", position.coords)
        const { latitude, longitude } = position.coords
        getWeatherByCoords(latitude, longitude)
      },
      (error) => {
        console.error("Geolocation error:", error)
        hideLoader()
        let errorMsg = "Unable to get your location. "

        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMsg += "Please allow location access and try again."
            break
          case error.POSITION_UNAVAILABLE:
            errorMsg += "Location information is unavailable."
            break
          case error.TIMEOUT:
            errorMsg += "Location request timed out."
            break
          default:
            errorMsg += "An unknown error occurred."
            break
        }

        showError(errorMsg)

        // Fallback to default city
        setTimeout(() => {
          getWeatherByCity("New York")
        }, 3000)
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000, // 5 minutes
      },
    )
  } else {
    showError("Geolocation is not supported by your browser")
    // Fallback to default city
    getWeatherByCity("New York")
  }
}

// Get weather by city name
async function getWeatherByCity(city) {
  console.log(`Getting weather for city: ${city}`)
  showLoader()

  try {
    // Get coordinates from city name
    const geoResponse = await fetch(`${GEO_URL}/direct?q=${city}&limit=1&appid=${API_KEY}`)

    if (!geoResponse.ok) {
      throw new Error(`HTTP error! status: ${geoResponse.status}`)
    }

    const geoData = await geoResponse.json()
    console.log("Geo data:", geoData)

    if (!geoData.length) {
      throw new Error("Location not found")
    }

    const { lat, lon, name, country } = geoData[0]
    currentCity = { name, country, lat, lon }
    localStorage.setItem("weatherLocation", city)

    await getWeatherByCoords(lat, lon, `${name}, ${country}`)
  } catch (error) {
    console.error("Error getting weather by city:", error)
    hideLoader()
    showError(`Error: ${error.message}`)
  }
}

// Get weather by coordinates
async function getWeatherByCoords(lat, lon, locationName = null) {
  console.log(`Getting weather for coordinates: ${lat}, ${lon}`)

  try {
    // Get current weather
    const weatherResponse = await fetch(
      `${BASE_URL}/weather?lat=${lat}&lon=${lon}&units=${currentUnit}&appid=${API_KEY}`,
    )

    if (!weatherResponse.ok) {
      throw new Error(`Weather API error: ${weatherResponse.status}`)
    }

    const currentWeather = await weatherResponse.json()
    console.log("Current weather:", currentWeather)

    // Get 5-day forecast (3-hour intervals)
    const forecastResponse = await fetch(
      `${BASE_URL}/forecast?lat=${lat}&lon=${lon}&units=${currentUnit}&appid=${API_KEY}`,
    )

    if (!forecastResponse.ok) {
      throw new Error(`Forecast API error: ${forecastResponse.status}`)
    }

    const forecastData = await forecastResponse.json()

    // Get air quality data
    let airQualityData = null
    try {
      const airQualityResponse = await fetch(
        `https://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lon}&appid=${API_KEY}`,
      )
      if (airQualityResponse.ok) {
        airQualityData = await airQualityResponse.json()
      }
    } catch (error) {
      console.warn("Air quality data not available:", error)
    }

    // Combine all data
    weatherData = {
      current: currentWeather,
      forecast: forecastData,
      airQuality: airQualityData,
      locationName: locationName || `${currentWeather.name}, ${currentWeather.sys.country}`,
    }

    console.log("Weather data compiled:", weatherData)

    // Update UI
    updateWeatherUI()
    hideLoader()
    showWeatherContainer()

    // Store current city for history
    if (!currentCity) {
      currentCity = {
        name: currentWeather.name,
        country: currentWeather.sys.country,
        lat: currentWeather.coord.lat,
        lon: currentWeather.coord.lon,
      }
    }
  } catch (error) {
    console.error("Error getting weather by coordinates:", error)
    hideLoader()
    showError("Failed to fetch weather data. Please try again.")
  }
}

// Update Weather UI
function updateWeatherUI() {
  console.log("Updating weather UI...")

  if (!weatherData) {
    console.error("No weather data available")
    return
  }

  const { current, forecast, airQuality, locationName } = weatherData

  // Update current weather
  if (cityElement) cityElement.textContent = locationName
  updateDateTime()
  if (weatherIconLarge) weatherIconLarge.innerHTML = getWeatherIcon(current.weather[0].id, true)
  if (temperatureElement) temperatureElement.textContent = `${Math.round(current.main.temp)}°`
  if (feelsLikeElement) feelsLikeElement.textContent = `Feels like: ${Math.round(current.main.feels_like)}°`
  if (weatherDescriptionElement)
    weatherDescriptionElement.textContent = capitalizeFirstLetter(current.weather[0].description)

  // Update weather details
  if (windSpeedElement)
    windSpeedElement.textContent = currentUnit === "metric" ? `${current.wind.speed} m/s` : `${current.wind.speed} mph`
  if (humidityElement) humidityElement.textContent = `${current.main.humidity}%`
  if (visibilityElement) visibilityElement.textContent = `${(current.visibility / 1000).toFixed(1)} km`
  if (pressureElement) pressureElement.textContent = `${current.main.pressure} hPa`

  // Update hourly forecast with 3-hour intervals
  updateHourlyForecast(forecast.list)

  // Update 5-day forecast
  updateForecast(forecast.list)

  // Update air quality if available
  if (airQuality && airQuality.list && airQuality.list.length > 0) {
    updateAirQuality(airQuality.list[0])
  } else {
    // Hide air quality section if not available
    const aqiContainer = document.querySelector(".air-quality-container")
    if (aqiContainer) {
      aqiContainer.style.display = "none"
    }
  }

  // Update sunrise/sunset
  updateSunriseSunset(current.sys.sunrise, current.sys.sunset, current.dt)

  // Update background animation based on weather
  updateWeatherAnimation(current.weather[0].id)

  // Save to history
  saveWeatherToHistory(weatherData)

  // Initialize or update map if we're on the map tab and have location data
  if (currentCity) {
    if (!weatherMap) {
      const mapTab = document.getElementById("map-tab")
      if (mapTab && mapTab.style.display !== "none") {
        initWeatherMap(currentCity.lat, currentCity.lon)
      }
    } else {
      updateMapLocation()
    }
  }

  console.log("Weather UI updated successfully")
}

// Update date and time
function updateDateTime() {
  const now = new Date()
  const options = {
    weekday: "long",
    hour: "numeric",
    minute: "numeric",
    hour12: true,
  }
  if (dateTimeElement) {
    dateTimeElement.textContent = now.toLocaleString("en-US", options)
  }
}

// Update hourly forecast to properly display 3-hour intervals
function updateHourlyForecast(hourlyData) {
  if (!hourlyContainer) return;

  console.log("✅ updateHourlyForecast called"); // Log once per city search

  // Clear any previously rendered hourly forecast items
  hourlyContainer.innerHTML = "";

  const now = new Date();

  // Show next 24 hours (8 data points at 3-hour intervals)
  hourlyData.slice(0, 8).forEach((hour) => {
    const hourTime = new Date(hour.dt * 1000);
    const hourElement = document.createElement("div");
    hourElement.className = "hourly-item";

    const hoursFromNow = Math.floor((hourTime - now) / (1000 * 60 * 60));

    hourElement.innerHTML = `
      <p>${hoursFromNow > 0 ? `+${hoursFromNow}h` : "Now"}</p>
      ${getWeatherIcon(hour.weather[0].id)}
      <p class="hourly-temp">${Math.round(hour.main.temp)}°</p>
    `;

    hourlyContainer.appendChild(hourElement);
  });
}

  // Add note about 3-hour intervals
  const note = document.createElement("p")
  note.className = "hourly-note"
  note.textContent = "Forecast shows 3-hour intervals"
  hourlyContainer.parentNode.insertBefore(note, hourlyContainer.nextSibling)

// Update 5-day forecast
function updateForecast(forecastList) {
  if (!forecastCards) return

  forecastCards.innerHTML = ""

  // Group forecast by day
  const dailyForecasts = {}

  forecastList.forEach((item) => {
    const date = new Date(item.dt * 1000)
    const day = date.toLocaleDateString("en-US", { weekday: "short" })

    if (!dailyForecasts[day]) {
      dailyForecasts[day] = {
        date: date,
        icon: item.weather[0].id,
        minTemp: item.main.temp_min,
        maxTemp: item.main.temp_max,
        description: item.weather[0].description,
        pop: item.pop || 0,
      }
    } else {
      dailyForecasts[day].minTemp = Math.min(dailyForecasts[day].minTemp, item.main.temp_min)
      dailyForecasts[day].maxTemp = Math.max(dailyForecasts[day].maxTemp, item.main.temp_max)
      dailyForecasts[day].pop = Math.max(dailyForecasts[day].pop, item.pop || 0)
    }
  })
  // Create forecast cards
  Object.keys(dailyForecasts)
    .slice(0, 5)
    .forEach((day) => {
      const forecast = dailyForecasts[day]
      const forecastCard = document.createElement("div")
      forecastCard.className = "forecast-card"

      forecastCard.innerHTML = `
        <div class="day">${day}</div>
        <div class="date">${forecast.date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}</div>
        ${getWeatherIcon(forecast.icon)}
        <div class="forecast-desc">${capitalizeFirstLetter(forecast.description)}</div>
        <div class="temp-range">
          <span class="max-temp">${Math.round(forecast.maxTemp)}°</span>
          <span class="min-temp">${Math.round(forecast.minTemp)}°</span>
        </div>
        <div class="forecast-pop">
          <i class="fas fa-droplet"></i> ${Math.round(forecast.pop * 100)}%
        </div>
      `

      forecastCards.appendChild(forecastCard)
    })
}

// Update air quality
function updateAirQuality(aqiData) {
  if (!aqiIndicator || !aqiDescription) return

  const aqi = aqiData.main.aqi
  let position, description

  switch (aqi) {
    case 1:
      position = "10%"
      description = "Good: Air quality is satisfactory, and air pollution poses little or no risk."
      break
    case 2:
      position = "35%"
      description = "Fair: Air quality is acceptable. However, there may be a risk for some people."
      break
    case 3:
      position = "60%"
      description = "Moderate: Members of sensitive groups may experience health effects."
      break
    case 4:
      position = "75%"
      description = "Poor: Everyone may begin to experience health effects."
      break
    case 5:
      position = "90%"
      description =
        "Very Poor: Health warnings of emergency conditions. The entire population is likely to be affected."
      break
    default:
      position = "10%"
      description = "No data available"
  }

  aqiIndicator.style.left = position
  aqiDescription.textContent = description
}

// Update sunrise/sunset
function updateSunriseSunset(sunrise, sunset, currentTime) {
  if (!sunriseTime || !sunsetTime || !sunPosition) return

  // Format times
  sunriseTime.textContent = new Date(sunrise * 1000).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  })

  sunsetTime.textContent = new Date(sunset * 1000).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  })

  // Calculate sun position
  const sunriseMs = sunrise * 1000
  const sunsetMs = sunset * 1000
  const currentMs = currentTime * 1000

  // If it's night time, position the sun at the appropriate edge
  if (currentMs < sunriseMs) {
    sunPosition.style.left = "0%"
    sunPosition.style.top = "100px"
  } else if (currentMs > sunsetMs) {
    sunPosition.style.left = "100%"
    sunPosition.style.top = "100px"
  } else {
    // Calculate position during day time
    const dayDuration = sunsetMs - sunriseMs
    const timeElapsed = currentMs - sunriseMs
    const percentage = (timeElapsed / dayDuration) * 100

    // Position horizontally
    sunPosition.style.left = `${percentage}%`

    // Position vertically (parabolic arc)
    const verticalPosition = 100 - Math.sin((percentage / 100) * Math.PI) * 100
    sunPosition.style.top = `${verticalPosition}px`
  }
}

// Update alerts (modify existing function)
function updateAlerts(alerts) {
  // Check for notifications first
  checkWeatherAlerts(alerts)

  if (alerts.length === 0) {
    alertsContainer.innerHTML = '<p class="no-alerts">No active weather alerts for this location.</p>'
    return
  }

  alertsContainer.innerHTML = ""
  alerts.forEach((alert) => {
    const alertElement = document.createElement("div")
    alertElement.className = "alert-item pulse"

    // Add severity indicator
    const severity = isSevereAlert(alert) ? "severe" : "moderate"
    alertElement.classList.add(`alert-${severity}`)

    alertElement.innerHTML = `
            <h4>
              <i class="fas fa-exclamation-triangle"></i> 
              ${alert.event}
              ${isSevereAlert(alert) ? '<span class="severe-badge">SEVERE</span>' : ""}
            </h4>
            <p>${alert.description}</p>
            <p class="alert-time">Until: ${new Date(alert.end * 1000).toLocaleString()}</p>
            <div class="alert-actions">
              <button onclick="shareAlert('${alert.event}')" class="share-alert-btn">
                <i class="fas fa-share"></i> Share
              </button>
            </div>
        `

    alertsContainer.appendChild(alertElement)
  })
}

// Share alert function
function shareAlert(alertEvent) {
  if (navigator.share) {
    navigator
      .share({
        title: `Weather Alert: ${alertEvent}`,
        text: `There's a weather alert for ${alertEvent} in ${currentCity ? currentCity.name : "this area"}. Stay safe!`,
        url: window.location.href,
      })
      .catch(console.error)
  } else {
    // Fallback: copy to clipboard
    const text = `Weather Alert: ${alertEvent} in ${currentCity ? currentCity.name : "this area"}. Stay safe! ${window.location.href}`
    navigator.clipboard
      .writeText(text)
      .then(() => {
        showSuccessMessage("Alert details copied to clipboard!")
      })
      .catch(() => {
        showError("Unable to share alert. Please copy the URL manually.")
      })
  }
}

// Change temperature unit
function changeUnit(unit) {
  console.log(`Changing unit to: ${unit}`)

  if (currentUnit === unit) return

  currentUnit = unit

  // Update UI
  if (unit === "metric") {
    if (celsiusBtn) celsiusBtn.classList.add("active")
    if (fahrenheitBtn) fahrenheitBtn.classList.remove("active")
  } else {
    if (celsiusBtn) celsiusBtn.classList.remove("active")
    if (fahrenheitBtn) fahrenheitBtn.classList.add("active")
  }

  // Reload weather data with new unit
  if (weatherData && currentCity) {
    getWeatherByCoords(currentCity.lat, currentCity.lon)
  }
}

// Get weather icon based on weather code
function getWeatherIcon(code, large = false) {
  let icon

  // Weather icon mapping based on OpenWeatherMap condition codes
  if (code >= 200 && code < 300) {
    icon = "fa-bolt" // Thunderstorm
  } else if (code >= 300 && code < 400) {
    icon = "fa-cloud-rain" // Drizzle
  } else if (code >= 500 && code < 600) {
    icon = "fa-cloud-showers-heavy" // Rain
  } else if (code >= 600 && code < 700) {
    icon = "fa-snowflake" // Snow
  } else if (code >= 700 && code < 800) {
    icon = "fa-smog" // Atmosphere (fog, mist, etc.)
  } else if (code === 800) {
    icon = "fa-sun" // Clear sky
  } else if (code === 801) {
    icon = "fa-cloud-sun" // Few clouds
  } else {
    icon = "fa-cloud" // Clouds
  }

  return `<i class="fas ${icon} ${large ? "fa-3x" : ""}"></i>`
}

// Create weather animation
function createWeatherAnimation() {
  const weatherAnimation = document.createElement("div")
  weatherAnimation.className = "weather-animation"
  document.body.appendChild(weatherAnimation)
}

// Update weather animation based on current weather
function updateWeatherAnimation(weatherCode) {
  const weatherAnimation = document.querySelector(".weather-animation")
  if (!weatherAnimation) return

  weatherAnimation.innerHTML = ""

  if (weatherCode >= 500 && weatherCode < 600) {
    // Rain animation
    for (let i = 0; i < 50; i++) {
      const raindrop = document.createElement("div")
      raindrop.className = "rain-drop"
      raindrop.style.left = `${Math.random() * 100}%`
      raindrop.style.animationDuration = `${Math.random() * 0.5 + 0.5}s`
      raindrop.style.animationDelay = `${Math.random() * 2}s`
      weatherAnimation.appendChild(raindrop)
    }
  } else if (weatherCode >= 600 && weatherCode < 700) {
    // Snow animation
    for (let i = 0; i < 50; i++) {
      const snowflake = document.createElement("div")
      snowflake.className = "snow-flake"
      snowflake.style.left = `${Math.random() * 100}%`
      snowflake.style.opacity = Math.random() * 0.5 + 0.5
      snowflake.style.animationDuration = `${Math.random() * 5 + 5}s`
      snowflake.style.animationDelay = `${Math.random() * 5}s`
      weatherAnimation.appendChild(snowflake)
    }
  }
}

// Add to recent searches
function addToRecentSearches(city) {
  // Don't add duplicates
  if (!recentSearches.includes(city)) {
    recentSearches.unshift(city)

    // Keep only the last 5 searches
    if (recentSearches.length > 5) {
      recentSearches.pop()
    }

    // Save to localStorage
    localStorage.setItem("recentSearches", JSON.stringify(recentSearches))

    // Update UI
    updateRecentSearchesUI()
  }
}

// Load recent searches from localStorage
function loadRecentSearches() {
  const saved = localStorage.getItem("recentSearches")
  if (saved) {
    try {
      recentSearches = JSON.parse(saved)
      updateRecentSearchesUI()
    } catch (error) {
      console.error("Error loading recent searches:", error)
      recentSearches = []
    }
  }
}

// Update recent searches UI
function updateRecentSearchesUI() {
  const recentLocations = document.getElementById("recent-locations")
  if (!recentLocations) return

  recentLocations.innerHTML = ""

  recentSearches.forEach((city) => {
    const item = document.createElement("div")
    item.className = "recent-location-item"
    item.innerHTML = `<i class="fas fa-history"></i> ${city}`

    item.addEventListener("click", () => {
      if (searchInput) searchInput.value = city
      getWeatherByCity(city)
    })

    recentLocations.appendChild(item)
  })
}

// Helper functions
function showLoader() {
  if (loader) loader.style.display = "flex"
  if (weatherContainer) weatherContainer.style.display = "none"
  if (errorContainer) errorContainer.style.display = "none"
}

function hideLoader() {
  if (loader) loader.style.display = "none"
}

function showError(message) {
  console.error("Showing error:", message)
  if (errorContainer) errorContainer.style.display = "block"
  if (errorMessage) errorMessage.textContent = message

  // Auto-hide error after 5 seconds
  setTimeout(() => {
    if (errorContainer) errorContainer.style.display = "none"
  }, 5000)
}

function showWeatherContainer() {
  if (weatherContainer) {
    weatherContainer.style.display = ""
    weatherContainer.classList.add("fade-in")
  }
}

function capitalizeFirstLetter(string) {
  return string.charAt(0).toUpperCase() + string.slice(1)
}

// Set up interval to update date and time
setInterval(updateDateTime, 60000) // Update every minute

// Make functions globally accessible
window.enableNotifications = enableNotifications
window.dismissNotificationPrompt = dismissNotificationPrompt
window.shareAlert = shareAlert
window.getUserLocation = getUserLocation
