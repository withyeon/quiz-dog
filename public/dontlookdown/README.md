# Don't Look Down 에셋

## platforms 폴더 (1.svg ~ 9.svg)

- **경로**: `public/dontlookdown/platforms/`
- **파일명**: `1.svg`, `2.svg`, … `9.svg` (총 9개)
- **크기**: 자유. 이미지의 실제 크기가 플랫폼 박스(충돌·표시 크기)가 됩니다.
- 이미지가 로드되면 각 플랫폼이 1~9 중 하나의 이미지를 쓰고, 그 이미지 크기대로 그려집니다.

이미지가 없거나 로드 실패 시 해당 플랫폼은 기본 색상 박스로 표시됩니다.

## powerup 폴더

- **경로**: `public/dontlookdown/powerup/`
- **파일명**: `PowerUpType`과 동일 (`shield.svg`, `rocket.svg`, `energy.svg`, `double_points.svg`, `ghost.svg`)
- 맵에 떨어진 파워업·우측 인벤토리 UI에 사용됩니다.
- 로드 실패 시 이모지로 폴백됩니다.
