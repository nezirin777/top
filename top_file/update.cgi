#!D:\Strawberry\perl\bin\perl

use strict;
use warnings;
use Encode qw(encode);
use utf8;
use JSON;

# =========================
# 設定
# =========================
my $MONSTERS_NEWS = "../monsters_py/html/news.html";
my $SYOUNIN_NEWS  = "../商人物語/akimono/news.html";
# =========================

my $kmon  = kousin($MONSTERS_NEWS);
my $ksyou = kousin($SYOUNIN_NEWS);

print "Content-type: application/json; charset=utf-8\n\n";

print encode_json({
    monsters => $kmon,
    syounin  => $ksyou,
});

#=========================================================
sub kousin {
    my $filename_raw = $_[0];
    my $filename = encode('cp932', $filename_raw);

    return undef unless -e $filename;

    my $lastmodified = (stat $filename)[9] // 0;
    my ($sec,$min,$hour,$mday,$mon,$year) = localtime($lastmodified);
    $year += 1900;
    $mon  += 1;
    return sprintf("%04d/%02d/%02d %02d:%02d:%02d",
        $year,$mon,$mday,$hour,$min,$sec);
}
