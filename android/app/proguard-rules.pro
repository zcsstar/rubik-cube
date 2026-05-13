# Cubist release build rules (minifyEnabled + shrinkResources are on).

# Keep stack traces useful when debugging crash reports from the Play Console.
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile

# Capacitor bridges JavaScript <-> native via reflection on @PluginMethod and
# @CapacitorPlugin annotated members. R8 must not strip them.
-keep @com.getcapacitor.annotation.CapacitorPlugin public class * { *; }
-keepclassmembers class * {
    @com.getcapacitor.PluginMethod public *;
    @com.getcapacitor.annotation.PermissionCallback public *;
    @com.getcapacitor.annotation.ActivityCallback public *;
}
-keep public class * extends com.getcapacitor.Plugin { *; }

# Google Mobile Ads (AdMob) loads classes by reflection in its dynamite module.
# Without these the SDK throws at runtime on minified builds.
-keep class com.google.android.gms.ads.** { *; }
-keep class com.google.android.gms.common.internal.safeparcel.** { *; }

# androidx.webkit reflection used by Capacitor's WebView shim.
-keep class androidx.webkit.** { *; }
