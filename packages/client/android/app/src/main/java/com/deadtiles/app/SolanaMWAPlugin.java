package com.deadtiles.app;

import android.app.ActivityOptions;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.drawable.BitmapDrawable;
import android.graphics.drawable.Drawable;
import android.net.Uri;
import android.os.Build;
import android.util.Base64;
import android.util.Log;

import java.io.ByteArrayOutputStream;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Bridges Solana Mobile Wallet Adapter in the Capacitor WebView.
 *
 * The MWA spec requires startActivityForResult so the wallet can call
 * getCallingPackage() and match this APK against Digital Asset Links.
 * Plain startActivity leaves the caller anonymous, which Phantom treats
 * as an unverified / impersonating app.
 */
@CapacitorPlugin(name = "SolanaMWA")
public class SolanaMWAPlugin extends Plugin {
    private static final String TAG = "SolanaMWA";
    private static final int MWA_ASSOCIATE_REQUEST = 0x4D57;
    private static final int ICON_SIZE = 64;

    private String preferredPackage;

    @Override
    public Boolean shouldOverrideLoad(Uri url) {
        if (url != null && "solana-wallet".equals(url.getScheme())) {
            launchWalletIntent(url);
            return true;
        }
        return null;
    }

    @PluginMethod()
    public void isAvailable(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("available", queryWallets().size() > 0);
        call.resolve(ret);
    }

    @PluginMethod()
    public void listWallets(PluginCall call) {
        PackageManager pm = getActivity().getPackageManager();
        JSArray wallets = new JSArray();
        for (ResolveInfo info : queryWallets()) {
            JSObject wallet = new JSObject();
            String packageName = info.activityInfo.packageName;
            wallet.put("packageName", packageName);
            wallet.put("label", info.loadLabel(pm).toString());
            String icon = iconDataUri(info.loadIcon(pm));
            if (icon != null) wallet.put("icon", icon);
            wallets.put(wallet);
        }
        JSObject ret = new JSObject();
        ret.put("wallets", wallets);
        call.resolve(ret);
    }

    @PluginMethod()
    public void setPreferredWallet(PluginCall call) {
        String packageName = call.getString("packageName");
        preferredPackage =
            packageName == null || packageName.isEmpty() ? null : packageName;
        call.resolve();
    }

    @PluginMethod()
    public void launchWalletUri(PluginCall call) {
        String uri = call.getString("uri");
        if (uri == null || uri.isEmpty()) {
            call.reject("Must provide uri");
            return;
        }
        boolean success = launchWalletIntent(Uri.parse(uri));
        if (success) {
            JSObject ret = new JSObject();
            ret.put("launched", true);
            call.resolve(ret);
        } else {
            call.reject(
                "No Solana wallet found. Install Phantom, Solflare, or Seed Vault."
            );
        }
    }

    private List<ResolveInfo> queryWallets() {
        Intent intent = new Intent(Intent.ACTION_VIEW);
        intent.setData(Uri.parse("solana-wallet:/v1/associate/local"));
        intent.addCategory(Intent.CATEGORY_BROWSABLE);

        PackageManager pm = getActivity().getPackageManager();
        List<ResolveInfo> resolvers;
        if (Build.VERSION.SDK_INT >= 33) {
            resolvers = pm.queryIntentActivities(
                intent,
                PackageManager.ResolveInfoFlags.of(PackageManager.MATCH_ALL)
            );
        } else {
            resolvers = pm.queryIntentActivities(intent, PackageManager.MATCH_ALL);
        }

        Map<String, ResolveInfo> unique = new LinkedHashMap<>();
        for (ResolveInfo info : resolvers) {
            if (info.activityInfo == null) continue;
            unique.putIfAbsent(info.activityInfo.packageName, info);
        }
        return new ArrayList<>(unique.values());
    }

    private boolean launchWalletIntent(Uri uri) {
        Intent intent = new Intent(Intent.ACTION_VIEW, uri);
        intent.addCategory(Intent.CATEGORY_BROWSABLE);
        intent.addCategory(Intent.CATEGORY_DEFAULT);
        if (preferredPackage != null) {
            intent.setPackage(preferredPackage);
        }

        try {
            if (Build.VERSION.SDK_INT >= 34) {
                ActivityOptions options = ActivityOptions.makeBasic();
                options.setShareIdentityEnabled(true);
                getActivity().startActivityForResult(
                    intent,
                    MWA_ASSOCIATE_REQUEST,
                    options.toBundle()
                );
            } else {
                getActivity().startActivityForResult(intent, MWA_ASSOCIATE_REQUEST);
            }
            getBridge().eval("window.dispatchEvent(new Event('blur'))", null);
            return true;
        } catch (ActivityNotFoundException e) {
            Log.e(TAG, "No MWA wallet for " + uri, e);
            return false;
        } catch (Exception e) {
            Log.e(TAG, "Failed to launch wallet intent", e);
            return false;
        }
    }

    private String iconDataUri(Drawable drawable) {
        try {
            Bitmap bitmap = drawableToBitmap(drawable);
            if (bitmap == null) return null;
            Bitmap scaled = Bitmap.createScaledBitmap(bitmap, ICON_SIZE, ICON_SIZE, true);
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            scaled.compress(Bitmap.CompressFormat.PNG, 90, out);
            return "data:image/png;base64," +
                Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP);
        } catch (Exception e) {
            return null;
        }
    }

    private Bitmap drawableToBitmap(Drawable drawable) {
        if (drawable instanceof BitmapDrawable) {
            Bitmap existing = ((BitmapDrawable) drawable).getBitmap();
            if (existing != null) return existing;
        }
        int width = Math.max(1, drawable.getIntrinsicWidth());
        int height = Math.max(1, drawable.getIntrinsicHeight());
        Bitmap bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888);
        Canvas canvas = new Canvas(bitmap);
        drawable.setBounds(0, 0, canvas.getWidth(), canvas.getHeight());
        drawable.draw(canvas);
        return bitmap;
    }
}
