/**
 * Status Bar Component for Node View Calibrator
 * Shows current file, environment, and save status
 */

export class StatusBar {
  constructor(fileInterface) {
    this.fileInterface = fileInterface;
    this.element = null;
    this.init();
  }

  /**
   * Initialize the status bar
   */
  init() {
    this.createElement();
    this.addStyles();
    this.updateStatus();
    
    // Update status periodically
    setInterval(() => this.updateStatus(), 1000);
  }

  /**
   * Create the status bar element
   */
  createElement() {
    this.element = document.createElement('div');
    this.element.id = 'statusBar';
    this.element.className = 'status-bar';
    
    this.element.innerHTML = `
      <div class="status-left">
        <span id="fileStatus" class="status-item"></span>
        <span id="envStatus" class="status-item"></span>
      </div>
      <div class="status-right">
        <span id="saveStatus" class="status-item"></span>
        <span id="displayCount" class="status-item"></span>
      </div>
    `;
    
    // Insert at the bottom of the container
    const container = document.querySelector('.container');
    if (container) {
      container.appendChild(this.element);
    } else {
      document.body.appendChild(this.element);
    }
  }

  /**
   * Add CSS styles for the status bar
   */
  addStyles() {
    const style = document.createElement('style');
    style.textContent = `
      .status-bar {
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        height: 24px;
        background: #2d2d30;
        color: #cccccc;
        font-size: 12px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 0 15px;
        border-top: 1px solid #3e3e42;
        z-index: 1000;
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      }
      
      .status-left, .status-right {
        display: flex;
        gap: 15px;
      }
      
      .status-item {
        display: flex;
        align-items: center;
        gap: 5px;
      }
      
      .status-icon {
        width: 12px;
        height: 12px;
        display: inline-block;
      }
      
      .file-modified {
        color: #f5dc4a;
      }
      
      .file-saved {
        color: #4CAF50;
      }
      
      .env-electron {
        color: #47C5FB;
      }
      
      .env-web {
        color: #FF6B6B;
      }
      
      .container {
        padding-bottom: 30px;
      }
      
      @media (max-width: 768px) {
        .status-bar {
          font-size: 11px;
          padding: 0 10px;
        }
        
        .status-left, .status-right {
          gap: 10px;
        }
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * Update the status bar content
   */
  updateStatus() {
    if (!this.element) return;
    
    const envInfo = this.fileInterface.getEnvironmentInfo();
    
    // File status
    const fileStatus = this.element.querySelector('#fileStatus');
    const fileName = envInfo.currentFile;
    const hasUnsaved = envInfo.hasUnsavedChanges;
    
    fileStatus.innerHTML = `
      <span class="status-icon">📄</span>
      <span>${fileName}${hasUnsaved ? ' •' : ''}</span>
    `;
    fileStatus.className = `status-item ${hasUnsaved ? 'file-modified' : 'file-saved'}`;
    
    // Environment status
    const envStatus = this.element.querySelector('#envStatus');
    envStatus.innerHTML = `
      <span class="status-icon">${envInfo.isElectron ? '🖥️' : '🌐'}</span>
      <span>${envInfo.platform}</span>
    `;
    envStatus.className = `status-item ${envInfo.isElectron ? 'env-electron' : 'env-web'}`;
    
    // Save status
    const saveStatus = this.element.querySelector('#saveStatus');
    saveStatus.innerHTML = `
      <span class="status-icon">${hasUnsaved ? '⚠️' : '✅'}</span>
      <span>${hasUnsaved ? 'Unsaved changes' : 'All changes saved'}</span>
    `;
    
    // Display count (this needs to be updated externally)
    this.updateDisplayCount(0);
  }

  /**
   * Update the display count
   * @param {number} count - Number of displays
   */
  updateDisplayCount(count) {
    const displayCount = this.element.querySelector('#displayCount');
    if (displayCount) {
      displayCount.innerHTML = `
        <span class="status-icon">🖼️</span>
        <span>${count} display${count !== 1 ? 's' : ''}</span>
      `;
    }
  }

  /**
   * Show a temporary message in the status bar
   * @param {string} message - Message to show
   * @param {number} duration - Duration in milliseconds
   */
  showMessage(message, duration = 3000) {
    const messageElement = document.createElement('div');
    messageElement.className = 'status-message';
    messageElement.textContent = message;
    messageElement.style.cssText = `
      position: absolute;
      left: 50%;
      transform: translateX(-50%);
      background: #007ACC;
      color: white;
      padding: 4px 12px;
      border-radius: 3px;
      font-weight: bold;
      animation: fadeInOut ${duration}ms ease-in-out;
    `;
    
    // Add animation
    const style = document.createElement('style');
    style.textContent = `
      @keyframes fadeInOut {
        0%, 100% { opacity: 0; transform: translateX(-50%) translateY(-10px); }
        10%, 90% { opacity: 1; transform: translateX(-50%) translateY(0); }
      }
    `;
    document.head.appendChild(style);
    
    this.element.appendChild(messageElement);
    
    setTimeout(() => {
      if (messageElement.parentNode) {
        messageElement.remove();
      }
      style.remove();
    }, duration);
  }

  /**
   * Destroy the status bar
   */
  destroy() {
    if (this.element && this.element.parentNode) {
      this.element.remove();
    }
  }
}
