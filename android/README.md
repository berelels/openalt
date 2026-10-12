# OpenAlt para Android (fork do Moonlight Android)

Este é o app Android do **OpenAlt** (Catta Studios): usar o celular ou tablet como outra tela do PC,
espelho ou tela de jogo. Ele é um **fork do [Moonlight Android](https://github.com/moonlight-stream/moonlight-android)**
12.2 (GPL-3.0), trazido com o histórico completo; o texto original do Moonlight segue abaixo, com os autores.

O que muda em relação ao Moonlight (ver `docs/adr/0012-app-android-fork-moonlight-e-qr.md`):
- pacote `dev.cattastudios.openalt`, nome e ícone do OpenAlt;
- tela **Parear** com leitor de QR (`dev.cattastudios.openalt.PairQrActivity`): pareia com o PC sem digitar PIN
  e confere o certificado do PC com o QR;
- tocar num PC pareado conecta direto no app "OpenAlt" do Sunshine;
- padrões: resolução nativa, 60 FPS, 10 Mbps; textos em pt-BR.

Compilar: `git submodule update --init --recursive` na raiz do repositório; depois, em `android/`,
`./gradlew assembleNonRootDebug testNonRootDebugUnitTest` (Android SDK + NDK 29.0.14206865). O GitHub Actions
(`.github/workflows/android.yml`) faz isso a cada mudança e guarda o APK.

Licença: GPL-3.0 (`LICENSE.txt`). Leitor de QR: [zxing-android-embedded](https://github.com/journeyapps/zxing-android-embedded) (Apache-2.0).

---

# Moonlight Android

[![AppVeyor Build Status](https://ci.appveyor.com/api/projects/status/232a8tadrrn8jv0k/branch/master?svg=true)](https://ci.appveyor.com/project/cgutman/moonlight-android/branch/master)
[![Translation Status](https://hosted.weblate.org/widgets/moonlight/-/moonlight-android/svg-badge.svg)](https://hosted.weblate.org/projects/moonlight/moonlight-android/)

[Moonlight for Android](https://moonlight-stream.org) is an open source client for NVIDIA GameStream and [Sunshine](https://github.com/LizardByte/Sunshine).

Moonlight for Android will allow you to stream your full collection of games from your Windows PC to your Android device,
whether in your own home or over the internet.

Moonlight also has a [PC client](https://github.com/moonlight-stream/moonlight-qt) and [iOS/tvOS client](https://github.com/moonlight-stream/moonlight-ios).

You can follow development on our [Discord server](https://moonlight-stream.org/discord) and help translate Moonlight into your language on [Weblate](https://hosted.weblate.org/projects/moonlight/moonlight-android/).

## Downloads
* [Google Play Store](https://play.google.com/store/apps/details?id=com.limelight)
* [Amazon App Store](https://www.amazon.com/gp/product/B00JK4MFN2)
* [F-Droid](https://f-droid.org/packages/com.limelight)
* [APK](https://github.com/moonlight-stream/moonlight-android/releases)

## Building
* Install Android Studio and the Android NDK
* Run ‘git submodule update --init --recursive’ from within moonlight-android/
* In moonlight-android/, create a file called ‘local.properties’. Add an ‘ndk.dir=’ property to the local.properties file and set it equal to your NDK directory.
* Build the APK using Android Studio or gradle

## Authors

* [Cameron Gutman](https://github.com/cgutman)  
* [Diego Waxemberg](https://github.com/dwaxemberg)  
* [Aaron Neyer](https://github.com/Aaronneyer)  
* [Andrew Hennessy](https://github.com/yetanothername)

Moonlight is the work of students at [Case Western](http://case.edu) and was
started as a project at [MHacks](http://mhacks.org).
