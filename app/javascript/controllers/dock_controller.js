import { Controller } from "@hotwired/stimulus"

export default class extends Controller {
  static targets = ["wrapper", "handle", "handleIcon", "handleText", "adminMenu", "adminTrigger"]

  connect() {
    this.isCollapsed = false
    this.isAdminOpen = false

    // Restore previous state from localStorage
    const savedState = localStorage.getItem("openitil_dock_collapsed")
    if (savedState === "true") {
      this.collapse(false)
    }

    // Bind event listeners
    this.onKeydown = this.handleKeydown.bind(this)
    this.onClickOutside = this.handleClickOutside.bind(this)

    window.addEventListener("keydown", this.onKeydown)
    document.addEventListener("click", this.onClickOutside)
  }

  disconnect() {
    window.removeEventListener("keydown", this.onKeydown)
    document.removeEventListener("click", this.onClickOutside)
  }

  toggle(event) {
    if (event) event.preventDefault()
    if (this.isCollapsed) {
      this.expand()
    } else {
      this.collapse()
    }
  }

  expand() {
    this.isCollapsed = false
    this.wrapperTarget.classList.remove("dock-collapsed")
    localStorage.setItem("openitil_dock_collapsed", "false")
    this.updateHandleAttributes(false)
  }

  collapse(save = true) {
    this.isCollapsed = true
    this.wrapperTarget.classList.add("dock-collapsed")
    if (this.isAdminOpen) {
      this.closeAdmin()
    }
    if (save) {
      localStorage.setItem("openitil_dock_collapsed", "true")
    }
    this.updateHandleAttributes(true)
  }

  updateHandleAttributes(collapsed) {
    if (!this.hasHandleTarget) return

    this.handleTarget.setAttribute("aria-expanded", (!collapsed).toString())
    const titleText = collapsed
      ? "Expandir barra de navegación (Alt + M)"
      : "Colapsar barra de navegación (Alt + M)"
    this.handleTarget.setAttribute("title", titleText)
    this.handleTarget.setAttribute("aria-label", titleText)

    if (this.hasHandleTextTarget) {
      this.handleTextTarget.textContent = collapsed ? "Mostrar Menú" : "Ocultar"
    }

    if (this.hasHandleIconTarget) {
      if (collapsed) {
        // Chevron pointing up to expand
        this.handleIconTarget.innerHTML = `<polyline points="18 15 12 9 6 15"></polyline>`
      } else {
        // Chevron pointing down to collapse
        this.handleIconTarget.innerHTML = `<polyline points="6 9 12 15 18 9"></polyline>`
      }
    }
  }

  toggleAdmin(event) {
    if (event) {
      event.preventDefault()
      event.stopPropagation()
    }

    if (!this.hasAdminMenuTarget) return

    this.isAdminOpen = !this.isAdminOpen
    if (this.isAdminOpen) {
      this.adminMenuTarget.classList.add("is-open")
      if (this.hasAdminTriggerTarget) {
        this.adminTriggerTarget.setAttribute("aria-expanded", "true")
        this.adminTriggerTarget.classList.add("active")
      }
    } else {
      this.closeAdmin()
    }
  }

  closeAdmin() {
    this.isAdminOpen = false
    if (this.hasAdminMenuTarget) {
      this.adminMenuTarget.classList.remove("is-open")
    }
    if (this.hasAdminTriggerTarget) {
      this.adminTriggerTarget.setAttribute("aria-expanded", "false")
      this.adminTriggerTarget.classList.remove("active")
    }
  }

  handleKeydown(event) {
    // Alt + M to toggle dock
    if (event.altKey && (event.key === "m" || event.key === "M")) {
      event.preventDefault()
      this.toggle()
      return
    }

    // Escape to close admin menu
    if (event.key === "Escape" && this.isAdminOpen) {
      event.preventDefault()
      this.closeAdmin()
    }
  }

  handleClickOutside(event) {
    if (!this.isAdminOpen) return

    const clickedInsideAdmin = this.hasAdminMenuTarget && this.adminMenuTarget.contains(event.target)
    const clickedTrigger = this.hasAdminTriggerTarget && this.adminTriggerTarget.contains(event.target)

    if (!clickedInsideAdmin && !clickedTrigger) {
      this.closeAdmin()
    }
  }
}
