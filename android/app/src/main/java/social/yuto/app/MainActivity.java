package social.yuto.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(YutoBlePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
