// Manages the sliding concept panel that appears when a hotspot is clicked

export class HotspotPanel {
  constructor() {
    this.panel = document.getElementById('concept-panel');
    this.titleEl = document.getElementById('concept-title');
    this.bodyEl = document.getElementById('concept-body');
    this.closeBtn = document.getElementById('concept-close');
    this.visible = false;

    this.closeBtn.addEventListener('click', () => this.hide());

    // Close on backdrop click
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.hide();
    });
  }

  show(title, body) {
    this.titleEl.textContent = title;
    this.bodyEl.innerHTML = body;
    this.panel.classList.add('visible');
    this.visible = true;
  }

  hide() {
    this.panel.classList.remove('visible');
    this.visible = false;
  }
}
