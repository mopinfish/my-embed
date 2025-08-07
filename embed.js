/**
 * Minimal Map Embed Library
 * A lightweight Web Component-based map embedding library
 * Compatible with MapLibre GL JS
 */

class MinimalMapEmbed extends HTMLElement {
  constructor() {
    super();

    // デフォルト設定
    this.defaults = {
      lat: 35.681236,
      lng: 139.767125,
      zoom: 10,
      style: "https://demotiles.maplibre.org/style.json",
    };

    this.map = null;
    this.mapContainer = null;
    this.isMapLibreLoaded = false;
  }

  // 監視する属性を定義
  static get observedAttributes() {
    return ["data-lat", "data-lng", "data-zoom", "data-style-json"];
  }

  // 属性変更時のコールバック
  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue !== newValue && this.map) {
      this.updateMapFromAttributes();
    }
  }

  // 要素がDOMに追加された時
  connectedCallback() {
    this.initializeComponent();
  }

  // 要素がDOMから削除された時
  disconnectedCallback() {
    if (this.map) {
      this.map.remove();
      this.map = null;
    }
  }

  // コンポーネントの初期化
  initializeComponent() {
    // スタイルを適用
    this.applyStyles();

    // マップコンテナを作成
    this.createMapContainer();

    // MapLibre GL JSをロード
    this.loadMapLibre()
      .then(() => {
        this.initializeMap();
      })
      .catch((error) => {
        console.error("Failed to load MapLibre GL JS:", error);
        this.showError("地図ライブラリの読み込みに失敗しました");
      });
  }

  // スタイルを適用
  applyStyles() {
    this.style.display = "block";
    this.style.width = this.style.width || "100%";
    this.style.height = this.style.height || "400px";
    this.style.position = "relative";
  }

  // マップコンテナを作成
  createMapContainer() {
    this.mapContainer = document.createElement("div");
    this.mapContainer.style.width = "100%";
    this.mapContainer.style.height = "100%";
    this.mapContainer.style.position = "relative";

    // ローディング表示
    const loading = document.createElement("div");
    loading.textContent = "地図を読み込み中...";
    loading.style.position = "absolute";
    loading.style.top = "50%";
    loading.style.left = "50%";
    loading.style.transform = "translate(-50%, -50%)";
    loading.style.color = "#666";
    loading.style.fontSize = "14px";
    loading.className = "loading-indicator";

    this.mapContainer.appendChild(loading);
    this.appendChild(this.mapContainer);
  }

  // MapLibre GL JSをロード
  async loadMapLibre() {
    // 既にロードされているかチェック
    if (window.maplibregl) {
      this.isMapLibreLoaded = true;
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      // CSS をロード
      const cssLink = document.createElement("link");
      cssLink.rel = "stylesheet";
      cssLink.href = "https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css";
      document.head.appendChild(cssLink);

      // JavaScript をロード
      const script = document.createElement("script");
      script.src = "https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js";
      script.onload = () => {
        this.isMapLibreLoaded = true;
        resolve();
      };
      script.onerror = () => {
        reject(new Error("MapLibre GL JS failed to load"));
      };
      document.head.appendChild(script);
    });
  }

  // 地図を初期化
  initializeMap() {
    try {
      if (!window.maplibregl) {
        throw new Error("MapLibre GL JSが利用できません");
      }

      console.log("MapLibre GL JS version:", window.maplibregl.version);

      // ローディング表示を削除
      const loading = this.mapContainer.querySelector(".loading-indicator");
      if (loading) {
        loading.remove();
      }

      // 属性から設定を取得
      const config = this.getConfigFromAttributes();

      // マップ設定オブジェクトを作成
      const mapConfig = {
        container: this.mapContainer,
        center: [config.lng, config.lat],
        zoom: config.zoom,
        antialias: true,
      };

      // スタイルが指定されている場合のみ追加
      if (config.style) {
        mapConfig.style = config.style;
        console.log("Using style:", config.style);
      }

      console.log("Creating map with config:", mapConfig);

      // マップを作成
      this.map = new window.maplibregl.Map(mapConfig);

      // 現在のスタイルURLを保存
      this.currentStyleUrl = config.style;

      // エラーハンドリング
      this.map.on("error", (e) => {
        console.error("Map error:", e);
        this.showError(
          "地図の表示でエラーが発生しました: " +
            (e.error?.message || "Unknown error")
        );
      });

      // ロード完了イベント
      this.map.on("load", () => {
        console.log("Map loaded successfully");
        this.dispatchEvent(
          new CustomEvent("map-loaded", {
            detail: { map: this.map },
          })
        );
      });

      console.log("Map initialization completed");
    } catch (error) {
      console.error("Map initialization failed:", error);
      this.showError("地図の初期化に失敗しました: " + error.message);
    }
  }

  // 属性から設定を取得
  getConfigFromAttributes() {
    const lat = parseFloat(this.getAttribute("data-lat"));
    const lng = parseFloat(this.getAttribute("data-lng"));
    const zoom = parseInt(this.getAttribute("data-zoom"));
    const style = this.getAttribute("data-style-json");

    const config = {
      lat: !isNaN(lat) ? lat : this.defaults.lat,
      lng: !isNaN(lng) ? lng : this.defaults.lng,
      zoom: !isNaN(zoom) ? zoom : this.defaults.zoom,
      style: style || this.defaults.style,
    };

    // デバッグ用ログ
    console.log("Map config:", config);

    return config;
  }

  // 属性変更に基づいてマップを更新
  updateMapFromAttributes() {
    if (!this.map) return;

    const config = this.getConfigFromAttributes();

    // 位置とズームを更新
    this.map.setCenter([config.lng, config.lat]);
    this.map.setZoom(config.zoom);

    // スタイルが変更された場合
    const newStyleUrl = config.style;
    const currentStyleUrl = this.currentStyleUrl;
    if (newStyleUrl && newStyleUrl !== currentStyleUrl) {
      this.map.setStyle(newStyleUrl);
      this.currentStyleUrl = newStyleUrl;
    }
  }

  // エラー表示
  showError(message) {
    this.mapContainer.innerHTML = `
      <div style="
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        color: #d32f2f;
        font-size: 14px;
        text-align: center;
        padding: 20px;
        background: #fff;
        border: 1px solid #ddd;
        border-radius: 4px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      ">
        <div style="margin-bottom: 8px;">⚠️</div>
        <div>${message}</div>
      </div>
    `;
  }

  // パブリックAPIメソッド
  getMap() {
    return this.map;
  }

  setCenter(lng, lat) {
    if (this.map) {
      this.map.setCenter([lng, lat]);
    }
    this.setAttribute("data-lng", lng);
    this.setAttribute("data-lat", lat);
  }

  setZoom(zoom) {
    if (this.map) {
      this.map.setZoom(zoom);
    }
    this.setAttribute("data-zoom", zoom);
  }

  setStyle(styleUrl) {
    if (this.map) {
      this.map.setStyle(styleUrl);
      this.currentStyleUrl = styleUrl;
    }
    this.setAttribute("data-style-json", styleUrl);
  }
}

// Web Componentとして登録
if (!customElements.get("minimal-map-embed")) {
  customElements.define("minimal-map-embed", MinimalMapEmbed);
}

// グローバルオブジェクトとしてもエクスポート（互換性のため）
if (typeof window !== "undefined") {
  window.MinimalMapEmbed = MinimalMapEmbed;
}

/**
 * 使用例:
 *
 * HTML:
 * <!DOCTYPE html>
 * <html>
 * <head>
 *     <meta charset="UTF-8">
 *     <title>Map Example</title>
 * </head>
 * <body>
 *     <!-- デモスタイル（デフォルト） -->
 *     <minimal-map-embed
 *         data-lat="35.681236"
 *         data-lng="139.767125"
 *         data-zoom="12"
 *         style="width: 100%; height: 400px;">
 *     </minimal-map-embed>
 *
 *     <!-- カスタムスタイル -->
 *     <minimal-map-embed
 *         data-lat="35.681236"
 *         data-lng="139.767125"
 *         data-zoom="12"
 *         data-style-json="https://tiles.stadiamaps.com/styles/alidade_smooth.json"
 *         style="width: 100%; height: 400px;">
 *     </minimal-map-embed>
 *
 *     <!-- ライブラリ読み込み -->
 *     <script src="http://localhost:8000/embed.js"></script>
 *
 *     <script>
 *         // イベントリスナー
 *         document.addEventListener('DOMContentLoaded', () => {
 *             const mapElements = document.querySelectorAll('minimal-map-embed');
 *
 *             mapElements.forEach(mapElement => {
 *                 mapElement.addEventListener('map-loaded', (event) => {
 *                     console.log('Map loaded:', event.detail.map);
 *                 });
 *             });
 *         });
 *
 *         // スタイル切り替えの例
 *         function switchStyle() {
 *             const mapElement = document.querySelector('minimal-map-embed');
 *             const styles = [
 *                 'https://demotiles.maplibre.org/style.json',
 *                 'https://tiles.stadiamaps.com/styles/alidade_smooth.json',
 *                 'https://tiles.stadiamaps.com/styles/alidade_smooth_dark.json'
 *             ];
 *             const currentStyle = mapElement.getAttribute('data-style-json') || 'https://demotiles.maplibre.org/style.json';
 *             const currentIndex = styles.indexOf(currentStyle);
 *             const nextIndex = (currentIndex + 1) % styles.length;
 *             mapElement.setStyle(styles[nextIndex]);
 *         }
 *     </script>
 *
 *     <!-- 操作ボタン -->
 *     <button onclick="switchStyle()">スタイル切り替え</button>
 * </body>
 * </html>
 */
