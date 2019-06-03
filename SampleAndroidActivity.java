package org.expodev.besttasktracker;

import android.content.Intent;
import android.os.Bundle;
import android.support.v7.app.AlertDialog;

import org.expodev.besttasktracker.api.Connection;
import org.expodev.besttasktracker.api.models.UserModel;
import org.expodev.besttasktracker.api.request.LazyLogin;

import java.io.BufferedReader;
import java.io.FileInputStream;
import java.io.FileNotFoundException;
import java.io.IOException;
import java.io.InputStreamReader;

public class MainActivity extends BaseActivity implements LazyLogin.CallBack, LazyLogin.FailureCallBack {

    private String userId = "";
    private LazyLogin user;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        if(isUserLoggeIn()){//todo commented just for testing login activity
            lazyLogin();
        }
        else{
            Intent intent = new Intent(".LoginActivity");
            startActivity(intent);
        }
    }

    private boolean isUserLoggeIn(){
        try {
            FileInputStream fileInput = openFileInput("user.txt");
            InputStreamReader reader = new InputStreamReader(fileInput);
            BufferedReader buffer = new BufferedReader(reader);
            StringBuffer strBuffer = new StringBuffer();
            String lines;

            while((lines = buffer.readLine()) != null){
                strBuffer.append(lines + "\n");
            }
            userId = strBuffer.toString();
            return true;
        }
        catch(FileNotFoundException e) {
            e.printStackTrace();
            //toast("User File Not Found");
            return false;
        } catch (IOException e) {
            e.printStackTrace();
            toast("Error 2: " + e.getMessage());
            return false;
        }
    }

    private void lazyLogin(){
        if(Connection.hasConnection(this)){
            user = new LazyLogin(userId,this, getString(R.string.base_url));
            user.execute();
        }
        else{
            final AlertDialog aboutDialog = new AlertDialog.Builder(MainActivity.this).setMessage(getString(R.string.no_internet_connection))
                    .setPositiveButton("OK", (dialog, which) -> {
                        finish();
                        startActivity(getIntent());
                    }).create();

            aboutDialog.show();
        }
    }

    public void loginResponse(UserModel user) {
        String id = user.getId();

        if(id != null){
            //todo  send user data to home activity
            Intent intent = new Intent(".HomeActivity");
            intent.putExtra(UserModel.class.getSimpleName(), user);
            startActivity(intent);
        }
    }

    @Override
    public void onFailureResponse(String errMsg) {
        final AlertDialog aboutDialog = new AlertDialog.Builder(MainActivity.this).setMessage( errMsg )
                .setPositiveButton("OK", (dialog, which) -> {
                    finish();
                    startActivity(getIntent());
                }).create();

        aboutDialog.show();
    }
}
