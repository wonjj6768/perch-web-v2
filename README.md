# Perch Web: AI Bird Vocalization Classifier

![License](https://img.shields.io/badge/license-MIT-blue.svg)


**Perch Web**은 Google의 **Perch v2** 모델을 활용하여 새 소리를 실시간으로 식별하는 경량 웹 애플리케이션입니다.
WebAssembly 기반의 ONNX Runtime Web 기술을 도입하여, 브라우저 내(Client-side)에서 모든 추론 과정을 수행합니다. 

## [Live Page](https://wonjj6768.github.io/perch-web-v2/web/)

![Perch Web Preview](web/assets/preview.png)

## 주요 기능 (Key Features)

*   **실시간 분석**: 5초 단위 오디오 즉시 분석 및 식별
*   **대규모 분류**: Google Perch v2 모델 기반 10,000종 이상 식별
*   **온디바이스 처리**: 100% 온디바이스 처리
*   **PWA 지원**: 앱처럼 설치 가능 및 오프라인 동작
*   **파일 업로드**: 다양한 오디오 포맷(WAV, MP3 등) 분석 지원

## License

This project is licensed under the MIT License.

### Third-Party Licenses

*   **Google Perch v2 Model**: Copyright 2024 The Perch Authors. Licensed under Apache License 2.0.
*   **ONNX Runtime Web**: Copyright (c) Microsoft Corporation. Licensed under MIT License.
*   **Pretendard Font**: Copyright (c) 2021 Kil Hyung-jin. Licensed under SIL Open Font License 1.1.


