# Gemini 그림 → 게임용 그림 변환 도구 (설치 없이 PowerShell만으로 동작)
#
# 사용법: powershell -ExecutionPolicy Bypass -File tools/prepare-assets.ps1
#
# assets/ 안의 원본 그림을 읽어서 assets/game/ 에 작은 게임용 그림을 만든다.
#   1. 단색 초록(#00FF00)·마젠타(#FF00FF) 배경을 투명하게
#   2. 오른쪽 아래 Gemini 반짝이 표시 지우기
#   3. 한 장에 여러 동작이 있으면 하나씩 잘라 냄 (왼쪽→오른쪽, 위→아래 순서)
#   4. nearest-neighbor 로 줄여서 도트가 흐려지지 않게
# 원본이 없는 그림은 건너뛰고, 만든 파일 목록을 assets/game/manifest.json 에 적는다.

$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$src = Join-Path $root 'assets'
$out = Join-Path $src 'game'
New-Item -ItemType Directory -Force $out | Out-Null

Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;

public class Blob { public int X, Y, W, H, Cells; }

public class Img {
  public int W, H;
  public byte[] Px; // BGRA

  public static Img Load(string path) {
    using (var src = new Bitmap(path)) {
      var img = new Img { W = src.Width, H = src.Height };
      using (var b = new Bitmap(img.W, img.H, PixelFormat.Format32bppArgb)) {
        using (var g = Graphics.FromImage(b)) g.DrawImage(src, new Rectangle(0, 0, img.W, img.H));
        var d = b.LockBits(new Rectangle(0, 0, img.W, img.H), ImageLockMode.ReadOnly, PixelFormat.Format32bppArgb);
        img.Px = new byte[img.W * img.H * 4];
        for (int y = 0; y < img.H; y++)
          Marshal.Copy(IntPtr.Add(d.Scan0, y * d.Stride), img.Px, y * img.W * 4, img.W * 4);
        b.UnlockBits(d);
      }
      return img;
    }
  }

  public static Img Blank(int w, int h) { return new Img { W = w, H = h, Px = new byte[w * h * 4] }; }

  public void Save(string path) {
    using (var b = new Bitmap(W, H, PixelFormat.Format32bppArgb)) {
      var d = b.LockBits(new Rectangle(0, 0, W, H), ImageLockMode.WriteOnly, PixelFormat.Format32bppArgb);
      for (int y = 0; y < H; y++)
        Marshal.Copy(Px, y * W * 4, IntPtr.Add(d.Scan0, y * d.Stride), W * 4);
      b.UnlockBits(d);
      b.Save(path, ImageFormat.Png);
    }
  }

  // 초록·마젠타 배경을 투명하게, 경계의 초록 번짐은 색만 빼기
  public void KeyOut() {
    for (int i = 0; i < Px.Length; i += 4) {
      int b = Px[i], g = Px[i + 1], r = Px[i + 2];
      bool green = g > 120 && g > r + 50 && g > b + 50;
      bool magenta = r > 150 && b > 150 && g < 110 && Math.Abs(r - b) < 90;
      if (green || magenta) { Px[i + 3] = 0; continue; }
      if (g > r + 20 && g > b + 20) Px[i + 1] = (byte)Math.Max(r, b);
    }
  }

  // 오른쪽 아래 Gemini 반짝이 자리 비우기
  public void ClearCorner(double fx, double fy) {
    for (int y = (int)(H * fy); y < H; y++)
      for (int x = (int)(W * fx); x < W; x++) Px[(y * W + x) * 4 + 3] = 0;
  }

  // 불투명한 덩어리 찾기 (cell 크기 칸 단위로 이어진 것끼리)
  public List<Blob> FindBlobs(int cell) {
    int gw = (W + cell - 1) / cell, gh = (H + cell - 1) / cell;
    var on = new bool[gw * gh];
    for (int cy = 0; cy < gh; cy++)
      for (int cx = 0; cx < gw; cx++) {
        int n = 0;
        for (int y = cy * cell; y < Math.Min(H, cy * cell + cell); y++)
          for (int x = cx * cell; x < Math.Min(W, cx * cell + cell); x++)
            if (Px[(y * W + x) * 4 + 3] > 0) n++;
        on[cy * gw + cx] = n * 4 >= cell * cell;
      }
    var seen = new bool[gw * gh];
    var blobs = new List<Blob>();
    var stack = new Stack<int>();
    for (int s = 0; s < on.Length; s++) {
      if (!on[s] || seen[s]) continue;
      int minx = int.MaxValue, miny = int.MaxValue, maxx = -1, maxy = -1, cells = 0;
      stack.Push(s); seen[s] = true;
      while (stack.Count > 0) {
        int c = stack.Pop(); int cx = c % gw, cy = c / gw; cells++;
        minx = Math.Min(minx, cx); maxx = Math.Max(maxx, cx); miny = Math.Min(miny, cy); maxy = Math.Max(maxy, cy);
        for (int dy = -1; dy <= 1; dy++)
          for (int dx = -1; dx <= 1; dx++) {
            int nx = cx + dx, ny = cy + dy;
            if (nx < 0 || ny < 0 || nx >= gw || ny >= gh) continue;
            int k = ny * gw + nx;
            if (on[k] && !seen[k]) { seen[k] = true; stack.Push(k); }
          }
      }
      blobs.Add(new Blob { X = minx * cell, Y = miny * cell, W = Math.Min(W, (maxx + 1) * cell) - minx * cell,
        H = Math.Min(H, (maxy + 1) * cell) - miny * cell, Cells = cells });
    }
    return blobs;
  }

  // 작은 잔상·먼지는 버리고, 줄(위→아래) → 칸(왼→오른) 순서로 정렬
  public static List<Blob> Order(List<Blob> blobs, double minHeightFrac) {
    int maxH = 0;
    foreach (var b in blobs) maxH = Math.Max(maxH, b.H);
    var keep = blobs.FindAll(b => b.H >= maxH * minHeightFrac);
    keep.Sort((a, b) => (a.Y + a.H / 2).CompareTo(b.Y + b.H / 2));
    var rows = new List<List<Blob>>();
    foreach (var b in keep) {
      var last = rows.Count > 0 ? rows[rows.Count - 1] : null;
      if (last != null && Math.Abs((b.Y + b.H / 2) - (last[0].Y + last[0].H / 2)) < maxH / 2) last.Add(b);
      else rows.Add(new List<Blob> { b });
    }
    var result = new List<Blob>();
    foreach (var r in rows) { r.Sort((a, b) => a.X.CompareTo(b.X)); result.AddRange(r); }
    return result;
  }

  // 덩어리를 fw×fh 칸에 맞춰 nearest-neighbor 로 줄여 dst 의 (ox, 0) 에 그림
  // anchor: "bottom" = 발이 칸 아래에 닿게, "center" = 가운데, "fill" = 칸을 꽉 채움
  public void Blit(Blob b, Img dst, int ox, int oy, int fw, int fh, string anchor) {
    double sx, sy;
    if (anchor == "fill") { sx = (double)fw / b.W; sy = (double)fh / b.H; }
    else { sx = sy = Math.Min((double)fw / b.W, (double)fh / b.H); }
    int tw = Math.Max(1, (int)Math.Round(b.W * sx)), th = Math.Max(1, (int)Math.Round(b.H * sy));
    int px = ox + (fw - tw) / 2;
    int py = oy + (anchor == "bottom" ? fh - th : (fh - th) / 2);
    for (int y = 0; y < th; y++)
      for (int x = 0; x < tw; x++) {
        int srcX = b.X + Math.Min(b.W - 1, (int)((x + 0.5) / sx));
        int srcY = b.Y + Math.Min(b.H - 1, (int)((y + 0.5) / sy));
        int si = (srcY * W + srcX) * 4, di = ((py + y) * dst.W + px + x) * 4;
        if (Px[si + 3] == 0) continue;
        dst.Px[di] = Px[si]; dst.Px[di + 1] = Px[si + 1]; dst.Px[di + 2] = Px[si + 2]; dst.Px[di + 3] = 255;
      }
  }

  // 그림 전체를 가로 width 로 줄이기 (배경 그림용)
  public Img ResizeWidth(int width) {
    int h = (int)Math.Round((double)H * width / W);
    var dst = Blank(width, h);
    Blit(new Blob { X = 0, Y = 0, W = W, H = H }, dst, 0, 0, width, h, "fill");
    for (int i = 3; i < dst.Px.Length; i += 4) dst.Px[i] = 255; // 배경 그림은 불투명
    return dst;
  }
}
'@

$made = @()

# 스프라이트 시트 → 같은 크기 칸이 가로로 이어진 한 장
function Sheet($file, $outName, $count, $fw, $fh, $anchor, $key = $true) {
  $path = Join-Path $src $file
  if (-not (Test-Path $path)) { return }
  $img = [Img]::Load($path)
  if ($key) { $img.KeyOut() }
  $img.ClearCorner(0.9, 0.86)
  $blobs = [Img]::Order($img.FindBlobs([Math]::Max(4, [int]($img.W / 300))), 0.6)
  if ($blobs.Count -lt $count) { Write-Warning "$file : expected $count sprites, found $($blobs.Count)"; $count = $blobs.Count }
  $dst = [Img]::Blank($fw * $count, $fh)
  for ($i = 0; $i -lt $count; $i++) { $img.Blit($blobs[$i], $dst, $i * $fw, 0, $fw, $fh, $anchor) }
  $dst.Save((Join-Path $out $outName))
  $script:made += [pscustomobject]@{ file = $outName; frameWidth = $fw; frameHeight = $fh; frames = $count }
  Write-Host "  $file -> $outName ($count x ${fw}x${fh})"
}

# 배경처럼 통째로 쓰는 그림
function Whole($file, $outName, $width) {
  $path = Join-Path $src $file
  if (-not (Test-Path $path)) { return }
  $img = [Img]::Load($path)
  $img.ClearCorner(0.9, 0.86)
  $dst = $img.ResizeWidth($width)
  $dst.Save((Join-Path $out $outName))
  $script:made += [pscustomobject]@{ file = $outName; frameWidth = $dst.W; frameHeight = $dst.H; frames = 1 }
  Write-Host "  $file -> $outName (${width}px)"
}

Write-Host 'Preparing assets...'
# 파일 이름, 결과 이름, 그림 개수, 칸 크기, 맞춤 방식
Sheet 'player_sheet.png' 'player.png' 4 28 28 'bottom'        # 앞, 뒤, 오른쪽, 왼쪽
Sheet 'player_walk.png' 'player_walk.png' 12 28 28 'bottom'   # 앞×3, 뒤×3, 오른쪽×3, 왼쪽×3
foreach ($npc in 'rabbit', 'cat', 'magpie', 'jindo', 'bear') {
  Sheet "npc_$npc.png" "npc_$npc.png" 1 200 200 'bottom'
}
Sheet 'van.png' 'van.png' 2 96 64 'bottom'                    # 옆, 위
Sheet 'stamps.png' 'stamps.png' 5 32 32 'center'              # 마스크팩, 응원봉, 스프레이, 네컷, 크로플
Sheet 'foods.png' 'foods.png' 5 16 16 'center'                # 떡볶이, 핫도그, 호떡, 붕어빵, 바나나우유
Sheet 'obstacles.png' 'obstacles.png' 5 28 28 'bottom'        # 관광객, 호객꾼, 오토바이, 비둘기, 구경꾼
Sheet 'tiles.png' 'tiles.png' 9 16 16 'fill'                  # 골목, 큰길, 중앙선, 나무, 역, 지붕, 앞면, 가로 간판, 세로 간판
Whole 'bg_alley.png' 'bg_alley.png' 360
Whole 'keyart.png' 'keyart.png' 360

$manifest = @{}
foreach ($m in $made) { $manifest[$m.file] = @{ frameWidth = $m.frameWidth; frameHeight = $m.frameHeight; frames = $m.frames } }
$json = if ($manifest.Count) { $manifest | ConvertTo-Json -Depth 3 } else { '{}' }
[IO.File]::WriteAllText((Join-Path $out 'manifest.json'), $json, (New-Object Text.UTF8Encoding $false))
Write-Host "Done. $($made.Count) file(s) in assets/game"
