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
      style: "geolonia/basic",
    };

    // Geoloniaスタイル定義
    this.geoloniaStyles = {
      "geolonia/basic": "https://cdn.geolonia.com/style/geolonia/basic/ja.json",
      "geolonia/gsi": "https://cdn.geolonia.com/style/geolonia/gsi/ja.json",
      "geolonia/midnight":
        "https://cdn.geolonia.com/style/geolonia/midnight/ja.json",
      "geolonia/red-planet":
        "https://cdn.geolonia.com/style/geolonia/red-planet/ja.json",
      "geolonia/notebook":
        "https://cdn.geolonia.com/style/geolonia/notebook/ja.json",
    };

    this.map = null;
    this.mapContainer = null;
    this.isMapLibreLoaded = false;
    this.apiKey = null;
  }

  // 監視する属性を定義
  static get observedAttributes() {
    return [
      "data-lat",
      "data-lng",
      "data-zoom",
      "data-style-json",
      "data-api-key",
      "data-style-control",
    ];
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
    if (this.styleControl) {
      this.removeStyleControl();
    }
    if (this.map) {
      this.map.remove();
      this.map = null;
    }
  }

  // コンポーネントの初期化
  initializeComponent() {
    // APIキーを取得
    this.parseApiKey();

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

  // APIキーを解析
  parseApiKey() {
    // data-api-key属性から取得
    this.apiKey = this.getAttribute("data-api-key");

    // 属性にない場合は、スクリプトタグのURLから取得を試行
    if (!this.apiKey) {
      const scripts = document.querySelectorAll('script[src*="embed.js"]');
      for (const script of scripts) {
        const url = new URL(script.src);
        const keyFromUrl = url.searchParams.get("geolonia-api-key");
        if (keyFromUrl) {
          this.apiKey = keyFromUrl;
          break;
        }
      }
    }

    // グローバル設定から取得
    if (!this.apiKey && window.geoloniaApiKey) {
      this.apiKey = window.geoloniaApiKey;
    }
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
        // GeoloniaスタイルかつAPIキーがある場合、ソースのURLにAPIキーを追加
        this.applyApiKeyToSources();

        // スタイルコントロールを追加
        this.addStyleControl();

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
      style: this.resolveStyleUrl(style || this.defaults.style),
    };

    // デバッグ用ログ
    console.log("Map config:", config);

    return config;
  }

  // スタイルURLを解決
  resolveStyleUrl(style) {
    // Geoloniaの名前付きスタイルかチェック
    if (this.geoloniaStyles[style]) {
      return this.geoloniaStyles[style];
    }

    // 完全なURLの場合はそのまま返す
    if (
      style &&
      (style.startsWith("http://") || style.startsWith("https://"))
    ) {
      return style;
    }

    // デフォルトスタイルにフォールバック
    const defaultStyleUrl = this.geoloniaStyles[this.defaults.style];
    if (defaultStyleUrl) {
      return defaultStyleUrl;
    }

    // APIキーがない場合はMapLibreデモスタイルを使用
    return "https://demotiles.maplibre.org/style.json";
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

  setStyle(style) {
    const resolvedUrl = this.resolveStyleUrl(style);
    if (this.map) {
      // 現在の地図の状態を保存
      const center = this.map.getCenter();
      const zoom = this.map.getZoom();
      const bearing = this.map.getBearing();
      const pitch = this.map.getPitch();

      // フォールバック処理のフラグ
      let hasErrorOccurred = false;
      let styleLoadTimeout = null;

      // エラーハンドラーを設定
      const errorHandler = (e) => {
        if (hasErrorOccurred) return; // 重複処理を防ぐ
        hasErrorOccurred = true;

        console.warn("Style loading error:", e);

        // タイムアウトをクリア
        if (styleLoadTimeout) {
          clearTimeout(styleLoadTimeout);
        }

        // エラー時は基本スタイルにフォールバック
        if (style !== "geolonia/basic") {
          console.log("Falling back to basic style due to error");
          this.showError(
            `「${this.getStyleDisplayName(
              style
            )}」の読み込みに失敗しました。基本スタイルに切り替えます。`
          );

          // イベントリスナーを削除
          this.map.off("error", errorHandler);
          this.map.off("style.load", styleLoadHandler);

          // 少し遅延してから基本スタイルを設定
          setTimeout(() => {
            this.setStyle("geolonia/basic");
          }, 500);
        } else {
          this.showError("基本スタイルの読み込みに失敗しました");
        }
      };

      // スタイル読み込み完了ハンドラー
      const styleLoadHandler = () => {
        if (hasErrorOccurred) return; // エラーが発生していた場合は処理しない

        // タイムアウトをクリア
        if (styleLoadTimeout) {
          clearTimeout(styleLoadTimeout);
        }

        // イベントリスナーを削除
        this.map.off("error", errorHandler);

        // 地図の状態を復元
        this.map.setCenter([center.lng, center.lat]);
        this.map.setZoom(zoom);
        this.map.setBearing(bearing);
        this.map.setPitch(pitch);

        // APIキーを適用
        this.applyApiKeyToSources();

        console.log(`Style loaded successfully: ${style}`);
      };

      // タイムアウト設定（10秒でフォールバック）
      styleLoadTimeout = setTimeout(() => {
        if (!hasErrorOccurred) {
          console.warn("Style loading timeout");
          errorHandler({ error: { message: "Style loading timeout" } });
        }
      }, 10000);

      // イベントリスナーを設定
      this.map.once("error", errorHandler);
      this.map.once("style.load", styleLoadHandler);

      try {
        this.map.setStyle(resolvedUrl);
        this.currentStyleUrl = resolvedUrl;
      } catch (error) {
        console.error("Failed to set style:", error);
        errorHandler({ error });
        return;
      }

      // スタイルコントロールの選択状態を更新
      if (this.styleControl && this.styleControl.updateSelection) {
        this.styleControl.updateSelection(style);
      }
    }
    this.setAttribute("data-style-json", style);
  }

  // スタイル表示名を取得
  getStyleDisplayName(styleId) {
    const styleMap = {
      "geolonia/basic": "基本",
      "geolonia/gsi": "地理院",
      "geolonia/midnight": "ミッドナイト",
      "geolonia/red-planet": "火星",
      "geolonia/notebook": "ノート",
    };
    return styleMap[styleId] || styleId;
  }

  // Geoloniaスタイルの一覧を取得
  getAvailableStyles() {
    // 地理院スタイルを除外した安定版のみを返す
    return Object.keys(this.geoloniaStyles).filter(
      (style) => style !== "geolonia/gsi"
    );
  }

  // APIキーを設定
  setApiKey(apiKey) {
    this.apiKey = apiKey;
    this.setAttribute("data-api-key", apiKey);

    // 地図が既に初期化されている場合はソースにAPIキーを適用
    if (this.map) {
      this.applyApiKeyToSources();
    }
  }

  // APIキーを取得
  getApiKey() {
    return this.apiKey;
  }

  // スタイルコントロールを追加
  addStyleControl() {
    // data-style-control属性がfalseの場合は追加しない
    const styleControlEnabled = this.getAttribute("data-style-control");
    if (styleControlEnabled === "false" || styleControlEnabled === "off") {
      return;
    }

    if (!this.map || this.styleControl) return;

    // カスタムコントロールクラスを定義
    class StyleControl {
      constructor(embed) {
        this.embed = embed;
        this.styles = [
          { id: "geolonia/basic", name: "基本", stable: true },
          // { id: 'geolonia/gsi', name: '地理院', stable: false }, // 一時的に無効化
          { id: "geolonia/midnight", name: "ミッドナイト", stable: true },
          { id: "geolonia/red-planet", name: "火星", stable: true },
          { id: "geolonia/notebook", name: "ノート", stable: true },
        ];
      }

      onAdd(map) {
        this.map = map;
        this.container = document.createElement("div");
        this.container.className = "maplibregl-ctrl maplibregl-ctrl-group";

        const select = document.createElement("select");
        select.style.cssText = `
          background: white;
          border: none;
          padding: 8px;
          font-size: 12px;
          font-family: inherit;
          cursor: pointer;
          outline: none;
          border-radius: 2px;
          box-shadow: 0 0 10px 2px rgba(0,0,0,0.1);
        `;

        // 現在のスタイルを取得
        const currentStyle =
          this.embed.getAttribute("data-style-json") ||
          this.embed.defaults.style;

        // オプションを追加
        this.styles.forEach((style) => {
          const option = document.createElement("option");
          option.value = style.id;
          option.textContent = style.stable
            ? style.name
            : `${style.name} (試験的)`;
          option.selected = style.id === currentStyle;

          // 不安定なスタイルは色を変える
          if (!style.stable) {
            option.style.color = "#ff6600";
            option.title = "一部のレイヤーでエラーが発生する可能性があります";
          }

          select.appendChild(option);
        });

        // 変更イベント
        select.addEventListener("change", (event) => {
          const newStyle = event.target.value;
          const selectedStyleInfo = this.styles.find((s) => s.id === newStyle);

          // 不安定なスタイルの場合は警告
          if (selectedStyleInfo && !selectedStyleInfo.stable) {
            const confirmMsg = `「${selectedStyleInfo.name}」は試験的な機能です。\n表示エラーが発生する場合があります。\n続行しますか？`;
            if (!confirm(confirmMsg)) {
              // キャンセルされた場合は元の選択に戻す
              const currentStyle =
                this.embed.getAttribute("data-style-json") ||
                this.embed.defaults.style;
              select.value = currentStyle;
              return;
            }
          }

          this.embed.setStyle(newStyle);
        });

        this.container.appendChild(select);
        this.select = select;

        return this.container;
      }

      onRemove() {
        if (this.container && this.container.parentNode) {
          this.container.parentNode.removeChild(this.container);
        }
        this.map = undefined;
      }

      // スタイル変更時にセレクトボックスを更新
      updateSelection(styleId) {
        if (this.select) {
          this.select.value = styleId;

          // 属性も更新
          this.embed.setAttribute("data-style-json", styleId);
        }
      }
    }

    // コントロールを作成して地図に追加
    this.styleControl = new StyleControl(this);
    this.map.addControl(this.styleControl, "top-left");
  }

  // スタイルコントロールを削除
  removeStyleControl() {
    if (this.styleControl && this.map) {
      this.map.removeControl(this.styleControl);
      this.styleControl = null;
    }
  }

  // ソースにAPIキーを適用
  applyApiKeyToSources() {
    if (!this.apiKey || !this.map) return;

    try {
      const currentStyle = this.map.getStyle();
      if (!currentStyle || !currentStyle.sources) return;

      let needsUpdate = false;
      const updatedStyle = JSON.parse(JSON.stringify(currentStyle)); // Deep copy

      // ソースのURLを更新
      for (const [sourceId, source] of Object.entries(updatedStyle.sources)) {
        if (source.url && source.url.includes("YOUR-API-KEY")) {
          source.url = source.url.replace(/YOUR-API-KEY/g, this.apiKey);
          needsUpdate = true;
        }
        // tiles配列内のAPIキーも更新（一部のスタイルで使用される場合）
        if (source.tiles && Array.isArray(source.tiles)) {
          source.tiles = source.tiles.map((tileUrl) => {
            if (
              typeof tileUrl === "string" &&
              tileUrl.includes("YOUR-API-KEY")
            ) {
              needsUpdate = true;
              return tileUrl.replace(/YOUR-API-KEY/g, this.apiKey);
            }
            return tileUrl;
          });
        }
      }

      // 更新が必要な場合はスタイル全体を再設定
      if (needsUpdate) {
        const center = this.map.getCenter();
        const zoom = this.map.getZoom();
        const bearing = this.map.getBearing();
        const pitch = this.map.getPitch();

        // スタイルを静かに更新（イベントを発生させない）
        this.map.setStyle(updatedStyle);

        // 位置を即座に復元
        this.map.setCenter([center.lng, center.lat]);
        this.map.setZoom(zoom);
        this.map.setBearing(bearing);
        this.map.setPitch(pitch);

        console.log("API key applied to sources successfully");
      }
    } catch (error) {
      console.warn("Failed to apply API key to sources:", error);
      // エラーの場合は何もしない（元のスタイルのまま）
    }
  }

  // フォールバック用の個別ソース更新メソッド
  applyApiKeyToSourcesFallback() {
    if (!this.apiKey || !this.map) return;

    const style = this.map.getStyle();
    if (!style || !style.sources) return;

    // Geoloniaのタイルサーバーを使用するソースにAPIキーを適用
    const sourcesToUpdate = [];
    for (const [sourceId, source] of Object.entries(style.sources)) {
      if (source.url && source.url.includes("YOUR-API-KEY")) {
        const updatedUrl = source.url.replace("YOUR-API-KEY", this.apiKey);
        if (updatedUrl !== source.url) {
          sourcesToUpdate.push({
            sourceId,
            source: { ...source, url: updatedUrl },
          });
        }
      }
    }

    // ソースを更新
    sourcesToUpdate.forEach(({ sourceId, source }) => {
      try {
        // そのソースを使用しているレイヤーを特定
        const layersUsingSource = style.layers.filter(
          (layer) => layer.source === sourceId
        );

        // レイヤーを一時的に削除
        const layerConfigs = [];
        layersUsingSource.forEach((layer) => {
          layerConfigs.push({
            id: layer.id,
            config: layer,
            beforeId: this.getNextLayerId(style.layers, layer.id),
          });
          this.map.removeLayer(layer.id);
        });

        // ソースを削除して再追加
        this.map.removeSource(sourceId);
        this.map.addSource(sourceId, source);

        // レイヤーを復元
        layerConfigs.forEach(({ id, config, beforeId }) => {
          this.map.addLayer(config, beforeId);
        });
      } catch (error) {
        console.warn(`Failed to update source ${sourceId}:`, error);
      }
    });
  }

  // レイヤーの次のレイヤーIDを取得（レイヤー順序復元用）
  getNextLayerId(layers, currentLayerId) {
    const currentIndex = layers.findIndex(
      (layer) => layer.id === currentLayerId
    );
    if (currentIndex >= 0 && currentIndex < layers.length - 1) {
      return layers[currentIndex + 1].id;
    }
    return undefined; // 最上位レイヤーの場合
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
 *     <title>Map Example with Style Control</title>
 * </head>
 * <body>
 *     <!-- スタイルコントロール付きの地図（デフォルトで有効） -->
 *     <h2>スタイルセレクター付き</h2>
 *     <minimal-map-embed
 *         data-lat="35.681236"
 *         data-lng="139.767125"
 *         data-zoom="12"
 *         data-api-key="YOUR-API-KEY"
 *         style="width: 100%; height: 400px; margin-bottom: 20px;">
 *     </minimal-map-embed>
 *
 *     <!-- スタイルコントロールを無効にした地図 -->
 *     <h2>スタイルセレクター無し</h2>
 *     <minimal-map-embed
 *         data-lat="35.681236"
 *         data-lng="139.767125"
 *         data-zoom="12"
 *         data-style-json="geolonia/midnight"
 *         data-style-control="false"
 *         data-api-key="YOUR-API-KEY"
 *         style="width: 100%; height: 400px; margin-bottom: 20px;">
 *     </minimal-map-embed>
 *
 *     <!-- URLパラメータでAPIキー指定 -->
 *     <script src="http://localhost:8000/embed.js?geolonia-api-key=YOUR-API-KEY"></script>
 *
 *     <!-- または個別スクリプト読み込み -->
 *     <!-- <script>window.geoloniaApiKey = 'YOUR-API-KEY';</script> -->
 *     <!-- <script src="http://localhost:8000/embed.js"></script> -->
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
 *         // プログラムでのスタイル切り替えの例
 *         function switchStyle() {
 *             const mapElement = document.querySelector('minimal-map-embed');
 *             const styles = mapElement.getAvailableStyles();
 *             const currentStyle = mapElement.getAttribute('data-style-json') || 'geolonia/basic';
 *             const currentIndex = styles.indexOf(currentStyle);
 *             const nextIndex = (currentIndex + 1) % styles.length;
 *             mapElement.setStyle(styles[nextIndex]);
 *             console.log('Switched to style:', styles[nextIndex]);
 *         }
 *
 *         // APIキー設定の例
 *         function setApiKey() {
 *             const mapElement = document.querySelector('minimal-map-embed');
 *             mapElement.setApiKey('YOUR-NEW-API-KEY');
 *             console.log('API key updated');
 *         }
 *     </script>
 *
 *     <!-- 操作ボタン -->
 *     <button onclick="switchStyle()">プログラムでスタイル切り替え</button>
 *     <button onclick="setApiKey()">APIキー更新</button>
 *
 *     <!-- スタイルコントロールの説明 -->
 *     <div style="margin-top: 20px;">
 *         <h3>スタイルコントロール機能:</h3>
 *         <ul>
 *             <li><strong>基本</strong> - geolonia/basic</li>
 *             <li><strong>地理院</strong> - geolonia/gsi</li>
 *             <li><strong>ミッドナイト</strong> - geolonia/midnight</li>
 *             <li><strong>火星</strong> - geolonia/red-planet</li>
 *             <li><strong>ノート</strong> - geolonia/notebook</li>
 *         </ul>
 *         <p><code>data-style-control="false"</code> で無効化できます。</p>
 *     </div>
 * </body>
 * </html>
 */
