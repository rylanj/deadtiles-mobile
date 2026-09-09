package com.deadtiles.game;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(SolanaMWAPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
