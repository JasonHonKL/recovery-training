# 腿後肌康復指南（Recovery Training）

為 50 歲、平時少運動的學習者設計的**膕旁肌（腿後肌）部分撕裂居家康復互動課程**（繁體中文）。
13 張手繪人體圖解、14 張流程圖、2 個互動實驗室（疼痛紅綠燈模擬器、兩週恢復計畫）。

## 線上瀏覽

https://jasonhonkl.github.io/recovery-training/

## 本機

直接開 `index.html`，或 `python3 -m http.server 8742`。

## 內容安全

一般性衛教與居家計畫參考，不構成醫療建議、不取代醫師或物理治療師評估。
出現第 4 章紅線（痛竄過膝蓋＋麻、無法踩地、夜痛、一週兩次紅燈、兩週零進步）請先回診。

## 開發

```bash
./build.sh            # 由 modules/ 與 labs.json 重新組裝 index.html、lab-data.js
node check.mjs --self-test
```
