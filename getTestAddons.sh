#!/bin/bash
if [[ ! -d testAddons ]]
then
    mkdir testAddons
fi

git clone https://github.com/Gethe/wow-ui-source testAddons/defaultUI
git clone https://github.com/WeakAuras/WeakAuras2 testAddons/WeakAuras2