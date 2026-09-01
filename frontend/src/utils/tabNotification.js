const SIZE = 32;
let baseIconUrl = null;
let badgedIconUrl = null;

function drawBaseIcon() {
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d");

  // Rounded square, matching the sidebar's brand-logo color.
  const radius = 7;
  ctx.fillStyle = "#2563EB";
  ctx.beginPath();
  ctx.moveTo(radius, 0);
  ctx.arcTo(SIZE, 0, SIZE, SIZE, radius);
  ctx.arcTo(SIZE, SIZE, 0, SIZE, radius);
  ctx.arcTo(0, SIZE, 0, 0, radius);
  ctx.arcTo(0, 0, SIZE, 0, radius);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#FFFFFF";
  ctx.font = "bold 16px Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("T", SIZE / 2, SIZE / 2 + 1);

  return canvas;
}

function getBaseIconUrl() {
  if (!baseIconUrl) {
    baseIconUrl = drawBaseIcon().toDataURL("image/png");
  }
  return baseIconUrl;
}

function getBadgedIconUrl() {
  if (!badgedIconUrl) {
    const canvas = drawBaseIcon();
    const ctx = canvas.getContext("2d");

    // Red dot, top-right, with a white ring so it stands out on any
    // browser's tab background.
    const r = 8;
    const cx = SIZE - r + 2;
    const cy = r - 2;

    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = "#FFFFFF";
    ctx.fill();

    ctx.beginPath();
    ctx.arc(cx, cy, r - 2, 0, Math.PI * 2);
    ctx.fillStyle = "#DC2626";
    ctx.fill();

    badgedIconUrl = canvas.toDataURL("image/png");
  }
  return badgedIconUrl;
}

function setFaviconHref(href) {
  let link = document.querySelector("link[rel~='icon']");
  if (!link) {
    link = document.createElement("link");
    link.rel = "icon";
    document.head.appendChild(link);
  }
  link.href = href;
}

const BASE_TITLE = document.title;

/*
|--------------------------------------------------------------------------
| updateTabNotification(count)
|--------------------------------------------------------------------------
| Call with the current unread count. 0 restores the normal tab title and
| icon; anything above 0 prefixes the title with the count and badges the
| favicon with a red dot — same idea as Slack/Gmail.
|--------------------------------------------------------------------------
*/

export function updateTabNotification(count) {
  if (count > 0) {
    const label = count > 99 ? "99+" : count;
    document.title = `(${label}) ${BASE_TITLE}`;
    setFaviconHref(getBadgedIconUrl());
  } else {
    document.title = BASE_TITLE;
    setFaviconHref(getBaseIconUrl());
  }
}